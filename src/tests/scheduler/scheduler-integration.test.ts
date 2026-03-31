/**
 * Scheduler Integration Tests
 *
 * End-to-end lifecycle tests proving the full scenario described in issue #10:
 *
 *   1. Orphaned executions are auto-cancelled by reconcile() and removed from
 *      the concurrency-active-count, unblocking the next valid run.
 *   2. Duplicate enqueue is prevented: starting a second execution while one is
 *      already running raises a UserConcurrencyLimitError.
 *   3. Recurrence timestamps always roll forward after a successful cycle.
 *   4. Full happy-path cycle: reconcile → trigger → complete → recurrence
 *      advances → state is clean for the next cycle.
 *   5. Idempotent reconcile: calling reconcile() twice on a healthy state leaves
 *      the state unchanged.
 *   6. Multi-cycle simulation: five consecutive hourly cycles all succeed and
 *      leave the system in a healthy state.
 *   7. Persistence: state written to a JSON file is reloaded correctly after a
 *      simulated process restart, including Date fields and execution history.
 *   8. Restart-survival: an in-flight execution that was never completed is
 *      detected as orphaned and cancelled by reconcile() after restart.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  reconcile,
  startExecution,
  completeExecution,
  shouldTrigger,
  checkConcurrency,
  EXECUTION_TIMEOUT_MS,
} from '../../../server/scheduler/workflow-scheduler';
import { checkMonitoring } from '../../../server/scheduler/monitoring';
import {
  buildIntentSignalDiscoveryState,
  INTENT_SIGNAL_DISCOVERY_TASK_ID,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
} from '../../../server/scheduler/intent-signal-discovery';
import {
  serializeSchedulerState,
  deserializeSchedulerState,
} from '../../../server/scheduler/json-file-store';
import type { Execution, SchedulerState } from '../../../server/scheduler/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CYCLE_START = new Date('2026-03-25T04:00:00Z');

/** Simulate a drifted state: workflow RUNNING, no active executions, stale dates */
function makeDriftedState(now: Date = CYCLE_START): SchedulerState {
  const base = buildIntentSignalDiscoveryState(now);
  const staleDate = new Date(now.getTime() - 2 * 3600_000); // 2 hours in the past
  return {
    workflow: {
      ...base.workflow,
      execution_status: 'running',  // false RUNNING – the incident symptom
      is_scheduled: false,
      updated_at: staleDate,
    },
    task: {
      ...base.task,
      execution_status: 'not_started',
      next_recurrence_date: staleDate,  // stale: 2 hours in the past
      updated_at: staleDate,
    },
    activeExecutions: [],
  };
}

/** Build an orphaned execution (started > EXECUTION_TIMEOUT_MS ago) */
function makeOrphanedExecution(now: Date = CYCLE_START): Execution {
  return {
    id: 'orphan-exec-1',
    task_id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
    workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
    status: 'running',
    started_at: new Date(now.getTime() - EXECUTION_TIMEOUT_MS - 60_000),  // 1 min past threshold
    completed_at: null,
    error: null,
  };
}

// ─── In-memory store helper ───────────────────────────────────────────────────

/**
 * Simulates the persistence adapter: a mutable store holding the current state.
 * This is structurally identical to what a PostgreSQL adapter would expose.
 */
class InMemorySchedulerStore {
  private state: SchedulerState;

  constructor(initialState: SchedulerState) {
    this.state = initialState;
  }

  read(): SchedulerState {
    return this.state;
  }

  write(state: SchedulerState): void {
    this.state = state;
  }

  /** Run reconcile() and persist the result — mirrors the /api/scheduler/reconcile handler */
  reconcile(now: Date = new Date()) {
    const result = reconcile(this.state, now);
    this.state = result.state;
    return result;
  }

  /** Start a new execution and persist — mirrors the /api/scheduler/trigger handler */
  startExecution(now: Date = new Date()) {
    const result = startExecution(this.state, now);
    this.state = result.state;
    return result.execution;
  }

  /** Complete an execution and persist — mirrors the job-completion callback */
  completeExecution(
    executionId: string,
    outcome: 'completed' | 'failed',
    error: string | null = null,
    now: Date = new Date(),
  ) {
    this.state = completeExecution(this.state, executionId, outcome, error, now);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Scheduler Integration: orphan cleanup unblocks valid runs', () => {
  let store: InMemorySchedulerStore;

  beforeEach(() => {
    // Start with a drifted state that has an orphaned execution blocking the
    // concurrency gate — exactly the incident condition in issue #10.
    const drifted = makeDriftedState(CYCLE_START);
    drifted.activeExecutions = [makeOrphanedExecution(CYCLE_START)];
    store = new InMemorySchedulerStore(drifted);
  });

  it('reconcile() cancels the orphaned execution', () => {
    const { actions } = store.reconcile(CYCLE_START);
    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain('clear_orphaned');
  });

  it('reconcile() resets false RUNNING workflow to not_started', () => {
    store.reconcile(CYCLE_START);
    expect(store.read().workflow.execution_status).toBe('not_started');
  });

  it('reconcile() reports cancelled orphan in result (for persistence)', () => {
    const result = store.reconcile(CYCLE_START);
    const orphan = result.cancelledExecutions.find((e) => e.id === 'orphan-exec-1');
    expect(orphan?.status).toBe('cancelled');
    expect(orphan?.error).toMatch(/Orphaned/);
  });

  it('after reconcile(), activeExecutions contains only running-status entries (invariant)', () => {
    store.reconcile(CYCLE_START);
    const allStatuses = store.read().activeExecutions.map((e) => e.status);
    expect(allStatuses.every((s) => s === 'running')).toBe(true);
  });

  it('after reconcile(), concurrency check allows a new execution', () => {
    store.reconcile(CYCLE_START);
    const check = checkConcurrency(store.read(), CYCLE_START);
    expect(check.allowed).toBe(true);
  });

  it('reconcile() advances the stale next_recurrence_date to the future', () => {
    store.reconcile(CYCLE_START);
    const { next_recurrence_date } = store.read().task;
    expect(next_recurrence_date).not.toBeNull();
    expect(next_recurrence_date!.getTime()).toBeGreaterThan(CYCLE_START.getTime());
  });

  it('reconcile() sets is_scheduled=true (scheduler source of truth)', () => {
    store.reconcile(CYCLE_START);
    expect(store.read().workflow.is_scheduled).toBe(true);
  });
});

describe('Scheduler Integration: duplicate enqueue prevention', () => {
  it('second startExecution() while first is running throws UserConcurrencyLimitError', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const triggerTime = new Date(CYCLE_START.getTime() + 3600_000 + 1); // after first due time

    // Force-start a first execution
    store.startExecution(triggerTime);
    expect(store.read().workflow.execution_status).toBe('running');

    // Attempting a second start must be blocked
    expect(() => store.startExecution(triggerTime)).toThrow(/UserConcurrencyLimitError/);
  });

  it('shouldTrigger() returns false while a non-orphaned execution is active', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const triggerTime = new Date(CYCLE_START.getTime() + 3600_000 + 1);

    store.startExecution(triggerTime);
    expect(shouldTrigger(store.read(), triggerTime)).toBe(false);
  });

  it('idempotent: starting and completing puts state back to triggerable', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const t1 = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const t2 = new Date(t1.getTime() + 30_000); // 30s later

    const exec = store.startExecution(t1);
    store.completeExecution(exec.id, 'completed', null, t2);

    // After completion, next_recurrence_date is +1h from t2
    const afterState = store.read();
    expect(afterState.workflow.execution_status).toBe('not_started');
    expect(afterState.task.next_recurrence_date!.getTime()).toBeGreaterThan(t2.getTime());
    // activeExecutions must be empty (strictly running-only invariant — nothing running after complete)
    expect(afterState.activeExecutions).toHaveLength(0);
  });
});

describe('Scheduler Integration: recurrence timestamps advance after each cycle', () => {
  it('next_recurrence_date rolls forward exactly 1 hour after successful completion', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const triggerTime = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const completeTime = new Date(triggerTime.getTime() + 5 * 60_000); // 5 min of work

    const exec = store.startExecution(triggerTime);
    store.completeExecution(exec.id, 'completed', null, completeTime);

    const next = store.read().task.next_recurrence_date!;
    expect(next.getTime()).toBe(completeTime.getTime() + 3600_000);
  });

  it('next_recurrence_date does NOT advance on failure', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const triggerTime = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const originalNext = store.read().task.next_recurrence_date!.getTime();
    const completeTime = new Date(triggerTime.getTime() + 5 * 60_000);

    const exec = store.startExecution(triggerTime);
    store.completeExecution(exec.id, 'failed', 'scan error', completeTime);

    // On failure the date should not have advanced past the failure time
    const next = store.read().task.next_recurrence_date;
    // Either still the original (pre-trigger) value or absent - either way not future
    if (next !== null) {
      expect(next.getTime()).toBeLessThanOrEqual(originalNext);
    }
  });

  it('task.updated_at advances with every cycle completion', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const t1 = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const t2 = new Date(t1.getTime() + 5 * 60_000);

    const exec = store.startExecution(t1);
    const beforeComplete = store.read().task.updated_at;
    store.completeExecution(exec.id, 'completed', null, t2);

    expect(store.read().task.updated_at.getTime()).toBeGreaterThan(beforeComplete.getTime());
  });
});

describe('Scheduler Integration: full incident-recovery cycle (issue #10)', () => {
  it('recovers from the exact incident state: RUNNING workflow, not_started task, stale dates', () => {
    // Reproduce the exact state from issue #10 evidence
    const incidentState: SchedulerState = {
      workflow: {
        id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
        name: 'Intent Signal Discovery',
        version: '1.0',
        execution_status: 'running',   // stuck RUNNING
        is_scheduled: false,           // scheduler disabled
        last_cycle_completed_at: null,
        created_at: new Date('2026-03-24T00:00:00Z'),
        updated_at: new Date('2026-03-24T00:00:00Z'),
      },
      task: {
        id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
        workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
        name: 'Hourly Intent Signal Scan',
        execution_status: 'not_started',  // not_started while workflow is RUNNING
        is_recurring: true,
        recurrence_pattern: 'hourly',
        next_recurrence_date: new Date('2026-03-24T01:00:00Z'),  // 25+ hours in the past
        last_executed_at: null,
        created_at: new Date('2026-03-24T00:00:00Z'),
        updated_at: new Date('2026-03-24T00:00:00Z'),
      },
      activeExecutions: [],  // zero active executions despite RUNNING status
    };

    const store = new InMemorySchedulerStore(incidentState);
    const remediationTime = new Date('2026-03-25T04:00:00Z');

    // Step 1: reconcile (the /api/scheduler/reconcile endpoint)
    const { actions } = store.reconcile(remediationTime);
    const actionTypes = actions.map((a) => a.type);

    expect(actionTypes).toContain('reset_workflow');       // clears false RUNNING
    expect(actionTypes).toContain('advance_recurrence');   // pushes next_recurrence_date forward
    expect(actionTypes).toContain('enable_scheduler');     // sets is_scheduled=true

    // Step 2: verify healthy state
    const afterReconcile = store.read();
    expect(afterReconcile.workflow.execution_status).toBe('not_started');
    expect(afterReconcile.workflow.is_scheduled).toBe(true);
    expect(afterReconcile.task.next_recurrence_date!.getTime()).toBeGreaterThan(
      remediationTime.getTime(),
    );

    // Step 3: trigger is now possible (recurrence gate opens)
    const atDueTime = new Date(afterReconcile.task.next_recurrence_date!.getTime() + 1);
    expect(shouldTrigger(store.read(), atDueTime)).toBe(true);

    // Step 4: run a cycle
    const exec = store.startExecution(atDueTime);
    const completeTime = new Date(atDueTime.getTime() + 5 * 60_000);
    store.completeExecution(exec.id, 'completed', null, completeTime);

    // Step 5: post-cycle state is clean
    const final = store.read();
    expect(final.workflow.execution_status).toBe('not_started');
    expect(final.workflow.last_cycle_completed_at!.getTime()).toBe(completeTime.getTime());
    expect(final.task.next_recurrence_date!.getTime()).toBe(
      completeTime.getTime() + 3600_000,
    );
    expect(checkMonitoring(final, completeTime)).toHaveLength(0);
  });
});

describe('Scheduler Integration: idempotent reconcile on healthy state', () => {
  it('calling reconcile() twice on a healthy state produces no-op on second call', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));

    const { actions: first } = store.reconcile(CYCLE_START);
    const stateAfterFirst = store.read();

    const { actions: second } = store.reconcile(CYCLE_START);
    const stateAfterSecond = store.read();

    // Both passes produce only 'none' on a healthy state (no drift or stale dates)
    expect(first.every((a) => a.type === 'none')).toBe(true);
    expect(second.every((a) => a.type === 'none')).toBe(true);

    // State should be identical
    expect(stateAfterSecond.workflow.execution_status).toBe(
      stateAfterFirst.workflow.execution_status,
    );
    expect(stateAfterSecond.task.next_recurrence_date?.getTime()).toBe(
      stateAfterFirst.task.next_recurrence_date?.getTime(),
    );
  });
});

describe('Scheduler Integration: multi-cycle simulation (6-hour window)', () => {
  it('5 consecutive hourly cycles all succeed and system stays healthy', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    let clock = CYCLE_START;

    for (let cycle = 1; cycle <= 5; cycle++) {
      // Advance clock to due time
      clock = new Date(store.read().task.next_recurrence_date!.getTime() + 1);

      expect(shouldTrigger(store.read(), clock)).toBe(true);

      const exec = store.startExecution(clock);
      const completedAt = new Date(clock.getTime() + 3 * 60_000); // 3 min cycle

      store.completeExecution(exec.id, 'completed', null, completedAt);
      clock = completedAt;

      const state = store.read();
      // Workflow must not be stuck in RUNNING between cycles
      expect(state.workflow.execution_status).toBe('not_started');
      // Recurrence must be in the future
      expect(state.task.next_recurrence_date!.getTime()).toBeGreaterThan(clock.getTime());
      // No monitoring alerts after each successful cycle
      expect(checkMonitoring(state, clock)).toHaveLength(0);
    }

    // After 5 cycles the last_cycle_completed_at must be set
    expect(store.read().workflow.last_cycle_completed_at).not.toBeNull();
  });

  it('task.updated_at advances with each cycle', () => {
    const store = new InMemorySchedulerStore(buildIntentSignalDiscoveryState(CYCLE_START));
    const updatedAts: number[] = [];

    for (let cycle = 1; cycle <= 3; cycle++) {
      const dueTime = new Date(store.read().task.next_recurrence_date!.getTime() + 1);
      const exec = store.startExecution(dueTime);
      const completedAt = new Date(dueTime.getTime() + 2 * 60_000);
      store.completeExecution(exec.id, 'completed', null, completedAt);
      updatedAts.push(store.read().task.updated_at.getTime());
    }

    // Each cycle should advance updated_at
    expect(updatedAts[1]).toBeGreaterThan(updatedAts[0]);
    expect(updatedAts[2]).toBeGreaterThan(updatedAts[1]);
  });
});

// ─── Persistence: serialization round-trip tests ───────────────────────────────

/**
 * These tests verify that SchedulerState can be serialized to JSON and
 * deserialized back with all Date objects intact — which is the critical
 * invariant for restart-survival. The serialization/deserialization logic is
 * the same code path that runs during file read/write in JsonFileSchedulerStore.
 *
 * This approach avoids real file I/O (which is not available in jsdom) while
 * still proving the persistence round-trip semantics used by the file store.
 */
describe('Scheduler Persistence: serialization round-trip survives simulated restart', () => {
  /**
   * Simulate a "write to disk + restart + read from disk" by serializing state
   * to a JSON string and deserializing it back. This is exactly what
   * JsonFileSchedulerStore does on write() + read() across a restart boundary.
   */
  function simulateRestart(state: SchedulerState): SchedulerState {
    return deserializeSchedulerState(serializeSchedulerState(state));
  }

  it('completed cycle state is reloaded correctly after simulated restart', () => {
    const seedState = buildIntentSignalDiscoveryState(CYCLE_START);

    // Run one cycle
    const t1 = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const { execution, state: startedState } = startExecution(seedState, t1);

    const t2 = new Date(t1.getTime() + 5 * 60_000);
    const completedState = completeExecution(startedState, execution.id, 'completed', null, t2);

    // Simulate process restart: serialize → JSON string → deserialize
    const reloaded = simulateRestart(completedState);

    // Cycle state must round-trip correctly
    expect(reloaded.workflow.execution_status).toBe('not_started');

    // last_cycle_completed_at must come back as a real Date, not a string
    expect(reloaded.workflow.last_cycle_completed_at).toBeInstanceOf(Date);
    expect(reloaded.workflow.last_cycle_completed_at!.getTime()).toBe(t2.getTime());

    // next_recurrence_date must be a real Date pointing to +1h after completion
    expect(reloaded.task.next_recurrence_date).toBeInstanceOf(Date);
    expect(reloaded.task.next_recurrence_date!.getTime()).toBe(t2.getTime() + 3600_000);

    // activeExecutions must be empty (strictly running-only invariant)
    expect(reloaded.activeExecutions).toHaveLength(0);
  });

  it('in-flight execution survives restart and is detected as orphaned by reconcile()', () => {
    const seedState = buildIntentSignalDiscoveryState(CYCLE_START);

    // Start an execution and "crash" before completing it
    const t1 = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const { state: startedState } = startExecution(seedState, t1);

    // Persist the in-flight state (write to disk), then restart (deserialize)
    const restartTime = new Date(t1.getTime() + EXECUTION_TIMEOUT_MS + 60_000);
    const reloaded = simulateRestart(startedState);

    // On restart the in-flight execution is still in activeExecutions (persisted)
    expect(reloaded.workflow.execution_status).toBe('running');
    expect(reloaded.activeExecutions).toHaveLength(1);
    // The active execution's started_at must be a Date, not a string
    expect(reloaded.activeExecutions[0].started_at).toBeInstanceOf(Date);

    // reconcile() detects the orphan and cancels it
    const { actions, cancelledExecutions } = reconcile(reloaded, restartTime);
    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain('clear_orphaned');
    expect(cancelledExecutions).toHaveLength(1);
    expect(cancelledExecutions[0].status).toBe('cancelled');

    // After reconcile, concurrency gate is open for the next valid execution
    const reconciledState = reconcile(reloaded, restartTime).state;
    expect(checkConcurrency(reconciledState, restartTime).allowed).toBe(true);
  });

  it('stale next_recurrence_date is advanced to the future after restart + reconcile()', () => {
    // Build a drifted state: next_recurrence_date 2 hours in the past
    const staleDate = new Date(CYCLE_START.getTime() - 2 * 3600_000);
    const driftedState = buildIntentSignalDiscoveryState(CYCLE_START);
    driftedState.task.next_recurrence_date = staleDate;
    driftedState.task.updated_at = staleDate;
    driftedState.workflow.execution_status = 'running';

    // Persist and reload (simulates a pre-existing stuck state that survives restart)
    const reloaded = simulateRestart(driftedState);

    // Confirm stale date survived the round-trip as a Date object
    expect(reloaded.task.next_recurrence_date).toBeInstanceOf(Date);
    expect(reloaded.task.next_recurrence_date!.getTime()).toBe(staleDate.getTime());

    // reconcile() must advance the stale date to the future
    const { actions } = reconcile(reloaded, CYCLE_START);
    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain('advance_recurrence');

    const reconciledState = reconcile(reloaded, CYCLE_START).state;
    expect(reconciledState.task.next_recurrence_date!.getTime()).toBeGreaterThan(
      CYCLE_START.getTime(),
    );
  });

  it('all date fields deserialize as Date instances (not strings)', () => {
    const seedState = buildIntentSignalDiscoveryState(CYCLE_START);

    // Complete one cycle to populate all date fields
    const t1 = new Date(CYCLE_START.getTime() + 3600_000 + 1);
    const { execution, state: startedState } = startExecution(seedState, t1);
    const t2 = new Date(t1.getTime() + 3 * 60_000);
    const completedState = completeExecution(startedState, execution.id, 'completed', null, t2);

    const reloaded = simulateRestart(completedState);

    // Verify all date fields are Date instances, not strings
    expect(reloaded.workflow.created_at).toBeInstanceOf(Date);
    expect(reloaded.workflow.updated_at).toBeInstanceOf(Date);
    expect(reloaded.workflow.last_cycle_completed_at).toBeInstanceOf(Date);
    expect(reloaded.task.created_at).toBeInstanceOf(Date);
    expect(reloaded.task.updated_at).toBeInstanceOf(Date);
    expect(reloaded.task.next_recurrence_date).toBeInstanceOf(Date);
  });
});

import { describe, it, expect } from 'vitest';
import {
  computeNextRecurrenceDate,
  hasStateDrift,
  findOrphanedExecutions,
  hasStaleRecurrenceDate,
  checkConcurrency,
  reconcile,
  startExecution,
  completeExecution,
  shouldTrigger,
  EXECUTION_TIMEOUT_MS,
  MAX_CONCURRENT_EXECUTIONS,
} from '../../../server/scheduler/workflow-scheduler';
import {
  checkMissedCadence,
  checkStateDrift,
  checkOrphanedExecutions,
  checkMonitoring,
  MISSED_CADENCE_THRESHOLD_MS,
} from '../../../server/scheduler/monitoring';
import {
  buildIntentSignalDiscoveryState,
  isIntentSignalDiscoveryState,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
  INTENT_SIGNAL_DISCOVERY_TASK_ID,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_VERSION,
} from '../../../server/scheduler/intent-signal-discovery';
import type { Execution, SchedulerState, Task } from '../../../server/scheduler/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-03-25T04:00:00Z');

function makeState(overrides: Partial<SchedulerState> = {}): SchedulerState {
  const base = buildIntentSignalDiscoveryState(NOW);
  return { ...base, ...overrides };
}

function makeRunningExecution(
  startedMsAgo = 0,
  id = 'exec-1',
): Execution {
  return {
    id,
    task_id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
    workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
    status: 'running',
    started_at: new Date(NOW.getTime() - startedMsAgo),
    completed_at: null,
    error: null,
  };
}

// ─── computeNextRecurrenceDate ────────────────────────────────────────────────

describe('computeNextRecurrenceDate', () => {
  it('adds 1 hour for hourly pattern', () => {
    const base = new Date('2026-03-25T10:00:00Z');
    const next = computeNextRecurrenceDate('hourly', base);
    expect(next.getTime()).toBe(new Date('2026-03-25T11:00:00Z').getTime());
  });

  it('adds 1 day for daily pattern', () => {
    const base = new Date('2026-03-25T10:00:00Z');
    const next = computeNextRecurrenceDate('daily', base);
    expect(next.getTime()).toBe(new Date('2026-03-26T10:00:00Z').getTime());
  });

  it('adds 7 days for weekly pattern', () => {
    const base = new Date('2026-03-25T10:00:00Z');
    const next = computeNextRecurrenceDate('weekly', base);
    expect(next.getTime()).toBe(new Date('2026-04-01T10:00:00Z').getTime());
  });

  it('adds 1 month for monthly pattern', () => {
    const base = new Date('2026-03-25T10:00:00Z');
    const next = computeNextRecurrenceDate('monthly', base);
    expect(next.getMonth()).toBe(3); // April
  });

  it('does not mutate the input date', () => {
    const base = new Date('2026-03-25T10:00:00Z');
    const orig = base.getTime();
    computeNextRecurrenceDate('hourly', base);
    expect(base.getTime()).toBe(orig);
  });
});

// ─── hasStateDrift ────────────────────────────────────────────────────────────

describe('hasStateDrift', () => {
  it('returns true when workflow is RUNNING but no active executions', () => {
    const state = makeState({
      workflow: { ...buildIntentSignalDiscoveryState(NOW).workflow, execution_status: 'running' },
      activeExecutions: [],
    });
    expect(hasStateDrift(state)).toBe(true);
  });

  it('returns false when workflow is RUNNING and has active executions', () => {
    const state = makeState({
      workflow: { ...buildIntentSignalDiscoveryState(NOW).workflow, execution_status: 'running' },
      activeExecutions: [makeRunningExecution()],
    });
    expect(hasStateDrift(state)).toBe(false);
  });

  it('returns false when workflow is not_started', () => {
    expect(hasStateDrift(makeState())).toBe(false);
  });
});

// ─── findOrphanedExecutions ───────────────────────────────────────────────────

describe('findOrphanedExecutions', () => {
  it('returns executions past the timeout', () => {
    const old = makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000);
    const fresh = makeRunningExecution(1_000, 'exec-2');
    const state = makeState({ activeExecutions: [old, fresh] });
    const orphaned = findOrphanedExecutions(state, NOW);
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0].id).toBe(old.id);
  });

  it('returns empty array when all executions are fresh', () => {
    const state = makeState({ activeExecutions: [makeRunningExecution(60_000)] });
    expect(findOrphanedExecutions(state, NOW)).toHaveLength(0);
  });

  it('returns empty array when no active executions', () => {
    expect(findOrphanedExecutions(makeState(), NOW)).toHaveLength(0);
  });
});

// ─── hasStaleRecurrenceDate ───────────────────────────────────────────────────

describe('hasStaleRecurrenceDate', () => {
  const { task } = buildIntentSignalDiscoveryState(NOW);

  it('returns true when next_recurrence_date is in the past', () => {
    const pastTask: Task = {
      ...task,
      next_recurrence_date: new Date(NOW.getTime() - 1),
    };
    expect(hasStaleRecurrenceDate(pastTask, NOW)).toBe(true);
  });

  it('returns false when next_recurrence_date is in the future', () => {
    const futureTask: Task = {
      ...task,
      next_recurrence_date: new Date(NOW.getTime() + 60_000),
    };
    expect(hasStaleRecurrenceDate(futureTask, NOW)).toBe(false);
  });

  it('returns false when next_recurrence_date equals now (due but not past)', () => {
    const exactTask: Task = { ...task, next_recurrence_date: new Date(NOW.getTime()) };
    expect(hasStaleRecurrenceDate(exactTask, NOW)).toBe(false);
  });

  it('returns true when next_recurrence_date is null', () => {
    const nullTask: Task = { ...task, next_recurrence_date: null };
    expect(hasStaleRecurrenceDate(nullTask, NOW)).toBe(true);
  });
});

// ─── checkConcurrency ────────────────────────────────────────────────────────

describe('checkConcurrency', () => {
  it('allows execution when no active executions', () => {
    expect(checkConcurrency(makeState()).allowed).toBe(true);
  });

  it('blocks when MAX_CONCURRENT_EXECUTIONS reached', () => {
    const executions = Array.from({ length: MAX_CONCURRENT_EXECUTIONS }, (_, i) =>
      makeRunningExecution(1_000, `exec-${i}`),
    );
    const state = makeState({ activeExecutions: executions });
    const result = checkConcurrency(state, NOW);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/UserConcurrencyLimitError/);
  });

  it('allows when only orphaned (timed-out) executions exist', () => {
    const orphaned = makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000);
    const state = makeState({ activeExecutions: [orphaned] });
    // Orphaned executions don't count toward the concurrency limit
    expect(checkConcurrency(state, NOW).allowed).toBe(true);
  });
});

// ─── reconcile ───────────────────────────────────────────────────────────────

describe('reconcile', () => {
  it('returns none when state is consistent', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() + 3600_000), // future
      },
    });
    const result = reconcile(state, NOW);
    expect(result.actions.some((a) => a.type === 'none')).toBe(true);
  });

  it('resets workflow state drift', () => {
    const driftState = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        execution_status: 'running',
        is_scheduled: false,
      },
      activeExecutions: [],
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() + 3600_000),
      },
    });
    const result = reconcile(driftState, NOW);
    expect(result.actions.some((a) => a.type === 'reset_workflow')).toBe(true);
    expect(result.state.workflow.execution_status).toBe('not_started');
  });

  it('cancels orphaned executions', () => {
    const orphaned = makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000);
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        execution_status: 'running',
      },
      activeExecutions: [orphaned],
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() + 3600_000),
      },
    });
    const result = reconcile(state, NOW);
    expect(result.actions.some((a) => a.type === 'clear_orphaned')).toBe(true);
    const cancelledExec = result.cancelledExecutions.find((e) => e.id === orphaned.id);
    expect(cancelledExec?.status).toBe('cancelled');
  });

  it('advances stale next_recurrence_date', () => {
    const staleTask: Task = {
      ...buildIntentSignalDiscoveryState(NOW).task,
      next_recurrence_date: new Date(NOW.getTime() - 7200_000), // 2 hrs ago
    };
    const state = makeState({ task: staleTask });
    const result = reconcile(state, NOW);
    expect(result.actions.some((a) => a.type === 'advance_recurrence')).toBe(true);
    expect(result.state.task.next_recurrence_date!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('enables is_scheduled when task is recurring but workflow.is_scheduled=false', () => {
    const baseState = buildIntentSignalDiscoveryState(NOW);
    const state = makeState({
      workflow: { ...baseState.workflow, is_scheduled: false },
      task: {
        ...baseState.task,
        next_recurrence_date: new Date(NOW.getTime() + 3600_000),
      },
    });
    const result = reconcile(state, NOW);
    expect(result.actions.some((a) => a.type === 'enable_scheduler')).toBe(true);
    expect(result.state.workflow.is_scheduled).toBe(true);
  });

  it('is idempotent: second call returns none', () => {
    const staleState = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        execution_status: 'running',
        is_scheduled: false,
      },
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() - 3600_000),
      },
      activeExecutions: [],
    });
    const first = reconcile(staleState, NOW);
    const second = reconcile(first.state, NOW);
    expect(second.actions.every((a) => a.type === 'none')).toBe(true);
  });
});

// ─── startExecution / completeExecution ──────────────────────────────────────

describe('startExecution', () => {
  it('creates a running execution and updates workflow/task status', () => {
    const { execution, state } = startExecution(makeState(), NOW);
    expect(execution.status).toBe('running');
    expect(state.workflow.execution_status).toBe('running');
    expect(state.task.execution_status).toBe('running');
    expect(state.workflow.is_scheduled).toBe(true);
    expect(state.activeExecutions).toHaveLength(1);
  });

  it('throws UserConcurrencyLimitError when limit reached', () => {
    const occupied = makeState({ activeExecutions: [makeRunningExecution(1_000)] });
    expect(() => startExecution(occupied, NOW)).toThrow(/UserConcurrencyLimitError/);
  });

  it('assigns a unique id to each execution', () => {
    const state1 = makeState();
    const { execution: e1, state: s1 } = startExecution(state1, NOW);
    // Reset to not_started so we can start another
    const resetState: SchedulerState = {
      ...s1,
      workflow: { ...s1.workflow, execution_status: 'not_started' },
      activeExecutions: [],
    };
    const { execution: e2 } = startExecution(resetState, NOW);
    expect(e1.id).not.toBe(e2.id);
  });
});

describe('completeExecution', () => {
  it('marks execution as completed and rolls next_recurrence_date forward', () => {
    const { execution, state: started } = startExecution(makeState(), NOW);
    const completed = completeExecution(started, execution.id, 'completed', null, NOW);

    expect(completed.workflow.execution_status).toBe('not_started');
    expect(completed.workflow.last_cycle_completed_at?.getTime()).toBe(NOW.getTime());
    expect(completed.task.execution_status).toBe('not_started');
    expect(completed.task.next_recurrence_date!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('sets workflow to failed on failure', () => {
    const { execution, state: started } = startExecution(makeState(), NOW);
    const failed = completeExecution(started, execution.id, 'failed', 'timeout', NOW);
    expect(failed.workflow.execution_status).toBe('failed');
    expect(failed.workflow.last_cycle_completed_at).toBeNull(); // not updated on failure
  });

  it('throws when execution id is not found', () => {
    const { state: started } = startExecution(makeState(), NOW);
    expect(() => completeExecution(started, 'nonexistent-id', 'completed')).toThrow();
  });
});

// ─── shouldTrigger ────────────────────────────────────────────────────────────

describe('shouldTrigger', () => {
  it('returns false when next_recurrence_date is in the future', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() + 3600_000),
      },
    });
    expect(shouldTrigger(state, NOW)).toBe(false);
  });

  it('returns true when next_recurrence_date is in the past and no active executions', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() - 1),
      },
    });
    expect(shouldTrigger(state, NOW)).toBe(true);
  });

  it('returns false when an active (non-orphaned) execution exists', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() - 1),
      },
      activeExecutions: [makeRunningExecution(60_000)], // 1 min old – not orphaned
    });
    expect(shouldTrigger(state, NOW)).toBe(false);
  });

  it('returns true when only orphaned executions exist', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        next_recurrence_date: new Date(NOW.getTime() - 1),
      },
      activeExecutions: [makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000)],
    });
    expect(shouldTrigger(state, NOW)).toBe(true);
  });

  it('returns false for non-recurring task', () => {
    const state = makeState({
      task: {
        ...buildIntentSignalDiscoveryState(NOW).task,
        is_recurring: false,
        next_recurrence_date: new Date(NOW.getTime() - 1),
      },
    });
    expect(shouldTrigger(state, NOW)).toBe(false);
  });
});

// ─── Monitoring ───────────────────────────────────────────────────────────────

describe('checkMissedCadence', () => {
  it('alerts when last_cycle_completed_at is null', () => {
    const alert = checkMissedCadence(makeState(), NOW);
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('missed_cadence');
  });

  it('alerts when last cycle was over threshold ago', () => {
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        last_cycle_completed_at: new Date(NOW.getTime() - MISSED_CADENCE_THRESHOLD_MS - 1_000),
      },
    });
    const alert = checkMissedCadence(state, NOW);
    expect(alert?.type).toBe('missed_cadence');
  });

  it('returns null when last cycle was within threshold', () => {
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        last_cycle_completed_at: new Date(NOW.getTime() - 30 * 60_000), // 30 min ago
      },
    });
    expect(checkMissedCadence(state, NOW)).toBeNull();
  });
});

describe('checkStateDrift (monitoring)', () => {
  it('alerts on drift', () => {
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        execution_status: 'running',
      },
      activeExecutions: [],
    });
    const alert = checkStateDrift(state, NOW);
    expect(alert?.type).toBe('state_drift');
  });

  it('returns null when no drift', () => {
    expect(checkStateDrift(makeState(), NOW)).toBeNull();
  });
});

describe('checkOrphanedExecutions (monitoring)', () => {
  it('alerts for each orphaned execution', () => {
    const old1 = makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000, 'e1');
    const old2 = makeRunningExecution(EXECUTION_TIMEOUT_MS + 2_000, 'e2');
    const state = makeState({ activeExecutions: [old1, old2] });
    const alerts = checkOrphanedExecutions(state, NOW);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].type).toBe('orphaned_execution');
  });

  it('returns empty array when no orphans', () => {
    const state = makeState({ activeExecutions: [makeRunningExecution(60_000)] });
    expect(checkOrphanedExecutions(state, NOW)).toHaveLength(0);
  });
});

describe('checkMonitoring (full suite)', () => {
  it('returns all applicable alerts', () => {
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        execution_status: 'running',
        last_cycle_completed_at: null,
      },
      activeExecutions: [makeRunningExecution(EXECUTION_TIMEOUT_MS + 1_000)],
    });
    const alerts = checkMonitoring(state, NOW);
    const types = alerts.map((a) => a.type);
    expect(types).toContain('missed_cadence');
    expect(types).toContain('orphaned_execution');
    // drift is masked by orphaned execution present, so state_drift may or may not fire
  });

  it('returns empty array for a healthy state with recent cycle', () => {
    const state = makeState({
      workflow: {
        ...buildIntentSignalDiscoveryState(NOW).workflow,
        last_cycle_completed_at: new Date(NOW.getTime() - 30 * 60_000),
      },
      activeExecutions: [],
    });
    const alerts = checkMonitoring(state, NOW);
    expect(alerts).toHaveLength(0);
  });
});

// ─── Intent Signal Discovery definition ──────────────────────────────────────

describe('buildIntentSignalDiscoveryState', () => {
  it('uses the well-known workflow and task IDs', () => {
    const { workflow, task } = buildIntentSignalDiscoveryState(NOW);
    expect(workflow.id).toBe(INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID);
    expect(task.id).toBe(INTENT_SIGNAL_DISCOVERY_TASK_ID);
  });

  it('sets is_scheduled=true (single scheduler source of truth)', () => {
    expect(buildIntentSignalDiscoveryState(NOW).workflow.is_scheduled).toBe(true);
  });

  it('sets execution_status=not_started (no false RUNNING idle)', () => {
    const { workflow, task } = buildIntentSignalDiscoveryState(NOW);
    expect(workflow.execution_status).toBe('not_started');
    expect(task.execution_status).toBe('not_started');
  });

  it('sets next_recurrence_date to 1 hour in the future', () => {
    const { task } = buildIntentSignalDiscoveryState(NOW);
    const expected = new Date(NOW.getTime() + 3600_000);
    expect(task.next_recurrence_date?.getTime()).toBe(expected.getTime());
  });

  it('sets recurrence_pattern=hourly', () => {
    expect(buildIntentSignalDiscoveryState(NOW).task.recurrence_pattern).toBe('hourly');
  });

  it('has the correct version', () => {
    expect(buildIntentSignalDiscoveryState(NOW).workflow.version).toBe(
      INTENT_SIGNAL_DISCOVERY_WORKFLOW_VERSION,
    );
  });
});

describe('isIntentSignalDiscoveryState', () => {
  it('returns true for the canonical state', () => {
    expect(isIntentSignalDiscoveryState(buildIntentSignalDiscoveryState(NOW))).toBe(true);
  });

  it('returns false for a different workflow id', () => {
    const state = buildIntentSignalDiscoveryState(NOW);
    expect(
      isIntentSignalDiscoveryState({
        ...state,
        workflow: { ...state.workflow, id: 'other-id' },
      }),
    ).toBe(false);
  });
});

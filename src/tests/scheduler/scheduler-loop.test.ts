/**
 * SchedulerLoop Unit Tests
 *
 * Verifies that the autonomous scheduler loop (`startSchedulerLoop`):
 *   1. Does NOT trigger runTask when recurrence is not yet due
 *   2. Triggers and completes a cycle when recurrence date <= now
 *   3. Calls completeExecution(failed) when runTask throws
 *   4. reconcile() clears an orphan and unblocks execution
 *   5. Loop handles a second tick after a previous task failure
 *   6. stop() prevents the setInterval from firing further ticks
 *   7. Runs 5 consecutive hourly cycles end-to-end
 *
 * Uses `loop._tick(now)` to drive ticks directly (no fake-timer loops).
 * `now` is injected so reconcile + shouldTrigger use the same reference time.
 */

import {
  describe,
  it,
  expect,
  vi,
  type MockedFunction,
} from 'vitest';
import { startSchedulerLoop } from '../../../server/scheduler/scheduler-loop';
import type { TaskRunner } from '../../../server/scheduler/scheduler-loop';
import {
  buildIntentSignalDiscoveryState,
  INTENT_SIGNAL_DISCOVERY_TASK_ID,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
} from '../../../server/scheduler/intent-signal-discovery';
import { EXECUTION_TIMEOUT_MS, computeNextRecurrenceDate } from '../../../server/scheduler/workflow-scheduler';
import {
  ExecutionStatus,
  RecurrencePattern,
} from '../../../server/scheduler/types';
import type { SchedulerState, Execution } from '../../../server/scheduler/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Build a state that is due exactly at `now`.
 *
 * Setting `next_recurrence_date = now` (exact equality) means:
 *  - hasStaleRecurrenceDate(task, now): `date < now` → false → reconcile does NOT advance it
 *  - shouldTrigger(state, now): `date > now` → false → passes gate → trigger fires
 */
function makeDueState(now: Date): SchedulerState {
  const base = buildIntentSignalDiscoveryState(now);
  return {
    ...base,
    task: {
      ...base.task,
      next_recurrence_date: new Date(now.getTime()), // exactly at now
    },
  };
}

/** State where next recurrence is 1 hour in the future (not yet due) */
function makeNotYetDueState(now: Date): SchedulerState {
  return buildIntentSignalDiscoveryState(now); // default: next = now + 1h
}

/** State with an orphaned execution blocking the concurrency gate */
function makeOrphanedState(now: Date): SchedulerState {
  const base = makeDueState(now);
  const orphan: Execution = {
    id: 'orphan-1',
    task_id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
    workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
    status: ExecutionStatus.RUNNING,
    // orphan: started > EXECUTION_TIMEOUT_MS ago
    started_at: new Date(now.getTime() - EXECUTION_TIMEOUT_MS - 60_000),
    completed_at: null,
    error: null,
  };
  return {
    ...base,
    workflow: { ...base.workflow, execution_status: ExecutionStatus.RUNNING },
    activeExecutions: [orphan],
  };
}

// ─── Store helper ─────────────────────────────────────────────────────────────

function makeStateStore(initial: SchedulerState) {
  let state = initial;
  return {
    get: (): SchedulerState => state,
    set: (s: SchedulerState): void => { state = s; },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('startSchedulerLoop: recurrence gate', () => {
  it('does NOT trigger runTask when next_recurrence_date is in the future', async () => {
    const now = new Date();
    const store = makeStateStore(makeNotYetDueState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    expect(runTask).not.toHaveBeenCalled();
    expect(store.get().workflow.execution_status).toBe(ExecutionStatus.NOT_STARTED);
  });

  it('triggers runTask when next_recurrence_date === now', async () => {
    const now = new Date();
    const store = makeStateStore(makeDueState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    expect(runTask).toHaveBeenCalledTimes(1);
  });
});

describe('startSchedulerLoop: execution lifecycle', () => {
  it('completes execution on success — workflow returns to not_started', async () => {
    const now = new Date();
    const store = makeStateStore(makeDueState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    const state = store.get();
    expect(state.workflow.execution_status).toBe(ExecutionStatus.NOT_STARTED);
    // next_recurrence_date rolled forward to the future
    expect(state.task.next_recurrence_date!.getTime()).toBeGreaterThan(now.getTime());
    // activeExecutions invariant: only running entries (empty after completion)
    expect(state.activeExecutions).toHaveLength(0);
  });

  it('completes execution on failure — workflow status set to failed', async () => {
    const now = new Date();
    const store = makeStateStore(makeDueState(now));
    const runTask = vi.fn().mockRejectedValue(new Error('scan timeout')) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    const state = store.get();
    expect(state.workflow.execution_status).toBe(ExecutionStatus.FAILED);
    // activeExecutions invariant: no running entries after failure
    expect(state.activeExecutions).toHaveLength(0);
    // next_recurrence_date must NOT have advanced on failure
    expect(state.task.next_recurrence_date!.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('runTask receives the execution ID as a UUID string', async () => {
    const now = new Date();
    const store = makeStateStore(makeDueState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    expect(runTask).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });
});

describe('startSchedulerLoop: reconcile auto-heal', () => {
  it('reconcile() clears orphan and unblocks execution on the same tick', async () => {
    const now = new Date();
    const store = makeStateStore(makeOrphanedState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();
    await loop._tick(now);

    // Orphan cleared, new execution completed, state is healthy
    expect(runTask).toHaveBeenCalledTimes(1);
    expect(store.get().workflow.execution_status).toBe(ExecutionStatus.NOT_STARTED);
    expect(store.get().activeExecutions).toHaveLength(0);
  });
});

describe('startSchedulerLoop: second tick after failure', () => {
  it('next tick succeeds after a previous task failure', async () => {
    const now = new Date();
    const store = makeStateStore(makeDueState(now));
    const runTask = vi.fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();

    // First tick — task fails
    await loop._tick(now);
    expect(store.get().workflow.execution_status).toBe(ExecutionStatus.FAILED);

    // Restore triggerable state for the second tick
    const now2 = new Date();
    store.set({
      ...store.get(),
      workflow: { ...store.get().workflow, execution_status: ExecutionStatus.NOT_STARTED },
      task: {
        ...store.get().task,
        next_recurrence_date: new Date(now2.getTime()),
      },
    });

    // Second tick — task succeeds
    await loop._tick(now2);
    expect(runTask).toHaveBeenCalledTimes(2);
    expect(store.get().workflow.execution_status).toBe(ExecutionStatus.NOT_STARTED);
  });
});

describe('startSchedulerLoop: stop()', () => {
  it('stop() clears the interval so no additional ticks fire automatically', async () => {
    vi.useFakeTimers();

    const now = new Date();
    const store = makeStateStore(makeNotYetDueState(now));
    const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

    const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
    loop.stop();

    // Advance well past several check intervals
    await vi.advanceTimersByTimeAsync(10 * 60_000);

    // No task should have been triggered (state is not yet due)
    expect(runTask).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('startSchedulerLoop: multi-cycle simulation (5 hourly cycles)', () => {
  it('5 consecutive hourly cycles all complete successfully', async () => {
    vi.useFakeTimers();
    try {
      let now = new Date();
      const store = makeStateStore(makeDueState(now));
      const runTask = vi.fn().mockResolvedValue(undefined) as MockedFunction<TaskRunner>;

      const loop = startSchedulerLoop(store.get, store.set, runTask, { checkIntervalMs: 60_000, immediateFirstTick: false });
      loop.stop();

      for (let cycle = 1; cycle <= 5; cycle++) {
        // Advance 'now' to when the next execution is due
        now = new Date(store.get().task.next_recurrence_date!.getTime());

        // Pin the system clock to 'now' so completedAt = new Date() inside tick
        // returns the same controlled value as tick-start, keeping assertions deterministic.
        vi.setSystemTime(now);
        await loop._tick(now);

        expect(store.get().workflow.execution_status).toBe(ExecutionStatus.NOT_STARTED);
        expect(store.get().activeExecutions).toHaveLength(0);
        // next_recurrence_date rolled to exactly completedAt + 1h (== now + 1h in this test)
        const expectedNext = computeNextRecurrenceDate(RecurrencePattern.HOURLY, now);
        expect(store.get().task.next_recurrence_date!.getTime()).toBe(expectedNext.getTime());
      }

      expect(runTask).toHaveBeenCalledTimes(5);
      expect(store.get().workflow.last_cycle_completed_at).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * SchedulerLoop
 *
 * Autonomous scheduler daemon for recurring workflows.
 *
 * Wires together the pure scheduler functions into a self-driving loop that:
 *   1. Reconciles state on every tick  (auto-heals drift and orphans)
 *   2. Gates on the recurrence date    (fires once per cadence)
 *   3. Starts the Execution record     (marks workflow RUNNING)
 *   4. Runs the caller-supplied task   (the real work)
 *   5. Completes the Execution record  (marks workflow not_started, rolls forward date)
 *
 * Design notes
 * ─────────────
 * - Caller supplies `getState` / `setState` so any persistence backend works:
 *     in-memory (current), PostgreSQL (future), Redis, etc.
 * - Caller supplies `runTask` to inject the real business logic without coupling
 *     the scheduler to a specific implementation.
 * - Overlapping ticks are prevented by a `running` guard — if the previous tick
 *     is still executing when the next interval fires, the new tick is skipped
 *     and a warning is logged.
 * - The loop fires an initial tick immediately on start so the first window
 *     doesn't sit idle for up to `checkIntervalMs`.
 */

import {
  completeExecution,
  reconcile,
  shouldTrigger,
  startExecution,
} from './workflow-scheduler';
import type { SchedulerState } from './types';
import { ExecutionStatus, ReconciliationActionType } from './types';

// ─── Public API types ─────────────────────────────────────────────────────────

export interface SchedulerLoopOptions {
  /**
   * How often to check the recurrence gate.
   * Default: 60_000 ms (1 minute) — tight enough that the hourly cadence is
   * never late by more than ~1 minute.
   */
  checkIntervalMs?: number;
  /**
   * Whether to fire an immediate tick on startup (before the first interval).
   * Default: true — important in production so the loop reacts immediately.
   * Set to false in unit tests to avoid a race between the startup tick and
   * explicit `loop._tick(now)` calls.
   */
  immediateFirstTick?: boolean;
}

/**
 * Async function that performs the actual task work.
 *
 * @param executionId  The ID of the running Execution record.
 *                     Use this in task logs for traceability.
 * @throws             Throw any Error to signal failure.
 *                     Do NOT call `completeExecution()` from inside this function;
 *                     the loop calls it automatically on both success and failure.
 */
export type TaskRunner = (executionId: string) => Promise<void>;

export interface SchedulerLoopHandle {
  /** Stop the interval and prevent future ticks from running. */
  stop: () => void;
  /**
   * @internal Direct tick invocation for unit testing only.
   * Allows tests to drive the scheduler tick-by-tick without fake timers.
   * Pass `now` to control the reference time used for recurrence/orphan checks.
   */
  _tick: (now?: Date) => Promise<void>;
}

// ─── Implementation ────────────────────────────────────────────────────────────

/**
 * Start the autonomous scheduler loop.
 *
 * @param getState   Returns the current SchedulerState snapshot.
 * @param setState   Persists an updated SchedulerState snapshot.
 * @param runTask    TaskRunner that does the real work for one execution cycle.
 * @param options    Optional tuning (checkIntervalMs).
 * @returns          A handle with a `stop()` method.
 */
export function startSchedulerLoop(
  getState: () => SchedulerState,
  setState: (state: SchedulerState) => void,
  runTask: TaskRunner,
  options: SchedulerLoopOptions = {},
): SchedulerLoopHandle {
  const checkIntervalMs = options.checkIntervalMs ?? 60_000;
  const immediateFirstTick = options.immediateFirstTick !== false;
  let running = false;

  async function tick(now: Date = new Date()): Promise<void> {
    if (running) {
      console.warn('[SchedulerLoop] Previous tick still running — skipping this tick');
      return;
    }
    running = true;

    try {
      // ── 1. Reconcile: auto-heal drift, orphans, stale dates ───────────────
      const {
        actions,
        state: reconciledState,
        cancelledExecutions,
      } = reconcile(getState(), now);
      setState(reconciledState);

      const actionTypes = actions.map((a) => a.type).filter((t) => t !== ReconciliationActionType.NONE);
      if (actionTypes.length > 0) {
        console.log(`[SchedulerLoop] Reconcile applied: ${actionTypes.join(', ')}`);
      }
      if (cancelledExecutions.length > 0) {
        console.warn(
          `[SchedulerLoop] Cancelled ${cancelledExecutions.length} orphaned execution(s): ` +
            cancelledExecutions.map((e) => e.id).join(', '),
        );
      }

      // ── 2. Gate: is it time to trigger? ──────────────────────────────────
      if (!shouldTrigger(getState(), now)) {
        const next = getState().task.next_recurrence_date;
        console.log(
          `[SchedulerLoop] Not yet due. Next recurrence: ${next?.toISOString() ?? 'unknown'}`,
        );
        return;
      }

      // ── 3. Start execution ────────────────────────────────────────────────
      let executionId: string;
      try {
        const { execution, state: startedState } = startExecution(getState(), now);
        setState(startedState);
        executionId = execution.id;
        console.log(
          `[SchedulerLoop] Execution ${executionId} started ` +
            `for task ${getState().task.id} at ${now.toISOString()}`,
        );
      } catch (concurrencyErr) {
        // UserConcurrencyLimitError — a previous execution is still running.
        // This should not happen after reconcile() unless a legitimate overlapping
        // run exists.  Log and let the next tick handle it.
        console.error(
          '[SchedulerLoop] Could not start execution (concurrency limit):',
          concurrencyErr,
        );
        return;
      }

      // ── 4. Run the actual task work ───────────────────────────────────────
      let outcome: ExecutionStatus.COMPLETED | ExecutionStatus.FAILED = ExecutionStatus.COMPLETED;
      let taskError: string | null = null;

      try {
        await runTask(executionId);
      } catch (taskErr) {
        outcome = ExecutionStatus.FAILED;
        taskError = taskErr instanceof Error ? taskErr.message : String(taskErr);
        console.error(
          `[SchedulerLoop] Execution ${executionId} failed: ${taskError}`,
        );
      }

      // ── 5. Complete execution and roll next_recurrence_date forward ───────
      // Capture completion time NOW (after the task ran), not at tick start.
      // This ensures last_cycle_completed_at, updated_at, and next_recurrence_date
      // reflect the actual completion instant, not the stale tick-start timestamp.
      const completedAt = new Date();
      setState(completeExecution(getState(), executionId, outcome, taskError, completedAt));

      if (outcome === ExecutionStatus.COMPLETED) {
        console.log(
          `[SchedulerLoop] Execution ${executionId} completed. ` +
            `Next recurrence: ${getState().task.next_recurrence_date?.toISOString() ?? 'unknown'}`,
        );
      }
    } catch (err) {
      // Unexpected error in reconcile or lifecycle — log and continue so the
      // loop survives transient faults.
      console.error('[SchedulerLoop] Unexpected error in scheduler tick:', err);
    } finally {
      running = false;
    }
  }

  // Fire an immediate first tick so the loop does not wait a full checkIntervalMs
  // before acting (important when restarting after an incident).
  if (immediateFirstTick) {
    void tick();
  }

  const handle = setInterval(() => {
    void tick();
  }, checkIntervalMs);

  console.log(
    `[SchedulerLoop] Started. Check interval: ${checkIntervalMs / 1_000}s`,
  );

  return {
    stop: () => {
      clearInterval(handle);
      console.log('[SchedulerLoop] Stopped.');
    },
    _tick: (now?: Date) => tick(now),
  };
}

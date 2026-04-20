/**
 * WorkflowScheduler
 *
 * Core scheduler logic for recurring workflows.
 *
 * Responsibilities
 * ─────────────────
 * 1. State-drift detection   – workflow RUNNING with no active execution
 * 2. Orphan-execution cleanup – executions that started but never completed
 * 3. Recurrence advancement   – stale next_recurrence_date pushed to future
 * 4. Concurrency guard        – enforce single active execution per task
 * 5. Scheduler-source-of-truth – enforce is_scheduled=true on the workflow
 *
 * Design notes
 * ─────────────
 * - Pure functions / no I/O: callers own persistence.
 * - All Date arithmetic uses UTC to avoid DST surprises.
 * - Immutable: methods return new state objects rather than mutating inputs.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ConcurrencyCheck,
  Execution,
  ReconciliationAction,
  ReconciliationResult,
  SchedulerState,
  Task,
  Workflow,
} from './types';
import { ExecutionStatus, ReconciliationActionType, RecurrencePattern } from './types';

/** How long an execution may stay in `running` before it is considered orphaned */
export const EXECUTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Maximum number of simultaneous active executions per task */
export const MAX_CONCURRENT_EXECUTIONS = 1;

/**
 * Thrown by `completeExecution` when the requested execution ID is not
 * present in `state.activeExecutions`.  Callers can use `instanceof
 * ExecutionNotFoundError` instead of fragile string-matching to distinguish
 * "already completed / idempotent" from unexpected errors.
 */
export class ExecutionNotFoundError extends Error {
  constructor(public readonly executionId: string) {
    super(`Execution ${executionId} not found in active executions`);
    this.name = 'ExecutionNotFoundError';
  }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Compute the next fire time given a recurrence pattern and a base timestamp.
 * Always returns a time strictly in the future relative to `from`.
 */
export function computeNextRecurrenceDate(
  pattern: RecurrencePattern,
  from: Date = new Date(),
): Date {
  const next = new Date(from.getTime());
  switch (pattern) {
    case RecurrencePattern.HOURLY:
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case RecurrencePattern.DAILY:
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case RecurrencePattern.WEEKLY:
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case RecurrencePattern.MONTHLY:
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * True when the workflow claims to be running but no truly-running execution exists.
 * Checks `status === 'running'` explicitly so that completed/cancelled entries
 * that may linger in the array do not mask real orchestration drift.
 */
export function hasStateDrift(state: SchedulerState): boolean {
  return (
    state.workflow.execution_status === ExecutionStatus.RUNNING &&
    state.activeExecutions.filter((e) => e.status === ExecutionStatus.RUNNING).length === 0
  );
}

/**
 * Return all executions that are still in `running` status and have been
 * running longer than EXECUTION_TIMEOUT_MS.
 * These are "orphaned" – they will never complete on their own.
 *
 * Non-running executions (completed, failed, cancelled) stored in
 * activeExecutions for history are excluded.
 */
export function findOrphanedExecutions(
  state: SchedulerState,
  now: Date = new Date(),
): Execution[] {
  return state.activeExecutions.filter(
    (exec) =>
      exec.status === ExecutionStatus.RUNNING &&
      now.getTime() - exec.started_at.getTime() > EXECUTION_TIMEOUT_MS,
  );
}

/**
 * True when task.next_recurrence_date is in the past (or absent).
 * A stale date means the scheduler will never fire again without intervention.
 */
export function hasStaleRecurrenceDate(
  task: Task,
  now: Date = new Date(),
): boolean {
  if (!task.next_recurrence_date) return true;
  return task.next_recurrence_date < now;
}

// ─── Concurrency guard ────────────────────────────────────────────────────────

/**
 * Decide whether a new execution may start.
 *
 * Returning `allowed: false` with a reason mirrors the `UserConcurrencyLimitError`
 * behaviour described in the issue – but *before* the execution is created, so
 * the workflow state is never poisoned.
 *
 * @param now  Injectable reference time (defaults to current wall-clock time).
 */
export function checkConcurrency(
  state: SchedulerState,
  now: Date = new Date(),
): ConcurrencyCheck {
  const nonOrphaned = state.activeExecutions.filter(
    (e) =>
      e.status === ExecutionStatus.RUNNING &&
      now.getTime() - e.started_at.getTime() <= EXECUTION_TIMEOUT_MS,
  );
  if (nonOrphaned.length >= MAX_CONCURRENT_EXECUTIONS) {
    return {
      allowed: false,
      reason:
        `UserConcurrencyLimitError: task ${state.task.id} already has ` +
        `${nonOrphaned.length} active execution(s). ` +
        'Clear orphaned executions before starting a new run.',
    };
  }
  return { allowed: true };
}

// ─── State reconciliation ─────────────────────────────────────────────────────

/**
 * Analyse `state` and return an updated state together with a description of
 * every corrective action taken.
 *
 * This is the primary entry-point for the "reconcile" API endpoint. Call it
 * whenever the scheduler suspects drift (e.g. on startup, or periodically).
 *
 * Actions are applied in priority order:
 *   1. Clear orphaned executions   (prerequisite for all other checks)
 *   2. Reset drifted workflow      (workflow RUNNING, 0 active executions)
 *   3. Advance stale recurrence    (next_recurrence_date in the past)
 *   4. Enforce is_scheduled=true   (single source of truth)
 */
export function reconcile(
  state: SchedulerState,
  now: Date = new Date(),
): ReconciliationResult {
  const actions: ReconciliationAction[] = [];
  let { workflow, task, activeExecutions } = state;
  const cancelledExecutions: Execution[] = [];

  // ── 1. Clear orphaned executions ──────────────────────────────────────────
  const orphaned = findOrphanedExecutions({ workflow, task, activeExecutions }, now);
  if (orphaned.length > 0) {
    const orphanedIds = new Set(orphaned.map((e) => e.id));
    const newlyCancelled: Execution[] = orphaned.map((e) => ({
      ...e,
      status: ExecutionStatus.CANCELLED,
      completed_at: now,
      error: `Orphaned: execution exceeded ${EXECUTION_TIMEOUT_MS / 60_000} min timeout`,
    }));

    // Remove orphaned entries from activeExecutions (strictly running-only)
    activeExecutions = activeExecutions.filter((e) => !orphanedIds.has(e.id));
    // Surface cancelled records to callers for persistence; do NOT put them back in activeExecutions
    cancelledExecutions.push(...newlyCancelled);

    actions.push({
      type: ReconciliationActionType.CLEAR_ORPHANED,
      description:
        `Cancelled ${orphaned.length} orphaned execution(s): ` +
        orphaned.map((e) => e.id).join(', '),
    });
  }

  // Active executions after orphan removal
  const stillActiveExecutions = activeExecutions.filter(
    (e) => e.status === ExecutionStatus.RUNNING,
  );

  // ── 2. Reset workflow state drift ─────────────────────────────────────────
  if (
    workflow.execution_status === ExecutionStatus.RUNNING &&
    stillActiveExecutions.length === 0
  ) {
    workflow = {
      ...workflow,
      execution_status: ExecutionStatus.NOT_STARTED,
      updated_at: now,
    };
    actions.push({
      type: ReconciliationActionType.RESET_WORKFLOW,
      description:
        'Workflow was RUNNING with no active executions (state drift). ' +
        'Reset execution_status to not_started.',
    });
  }

  // ── 3. Advance stale recurrence date ──────────────────────────────────────
  if (task.is_recurring && task.recurrence_pattern && hasStaleRecurrenceDate(task, now)) {
    const next = computeNextRecurrenceDate(task.recurrence_pattern, now);
    task = {
      ...task,
      next_recurrence_date: next,
      updated_at: now,
    };
    actions.push({
      type: ReconciliationActionType.ADVANCE_RECURRENCE,
      description:
        `Stale next_recurrence_date advanced to ${next.toISOString()} ` +
        `(+1 ${task.recurrence_pattern}).`,
    });
  }

  // ── 4. Enforce single scheduler source of truth ──────────────────────────
  if (task.is_recurring && !workflow.is_scheduled) {
    workflow = { ...workflow, is_scheduled: true, updated_at: now };
    actions.push({
      type: ReconciliationActionType.ENABLE_SCHEDULER,
      description:
        'Task is recurring but workflow.is_scheduled was false. ' +
        'Set is_scheduled=true to enforce single scheduler source of truth.',
    });
  }

  if (actions.length === 0) {
    actions.push({ type: ReconciliationActionType.NONE, description: 'State is consistent – no action required.' });
  }

  return {
    actions,
    state: { workflow, task, activeExecutions },
    cancelledExecutions,
  };
}

// ─── Execution lifecycle ──────────────────────────────────────────────────────

/**
 * Create a new Execution record for the given task/workflow.
 * Does NOT persist; caller must store the returned execution.
 *
 * Throws if the concurrency check fails so callers can catch
 * `UserConcurrencyLimitError`-equivalent messages.
 */
export function startExecution(
  state: SchedulerState,
  now: Date = new Date(),
): { execution: Execution; state: SchedulerState } {
  const check = checkConcurrency(state, now);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const execution: Execution = {
    id: uuidv4(),
    task_id: state.task.id,
    workflow_id: state.workflow.id,
    status: ExecutionStatus.RUNNING,
    started_at: now,
    completed_at: null,
    error: null,
  };

  const updatedWorkflow: Workflow = {
    ...state.workflow,
    execution_status: ExecutionStatus.RUNNING,
    is_scheduled: true,
    updated_at: now,
  };

  const updatedTask: Task = {
    ...state.task,
    execution_status: ExecutionStatus.RUNNING,
    last_executed_at: now,
    updated_at: now,
  };

  return {
    execution,
    state: {
      workflow: updatedWorkflow,
      task: updatedTask,
      activeExecutions: [...state.activeExecutions, execution],
    },
  };
}

/**
 * Mark an execution as completed (success or failure) and roll the workflow
 * and task state forward.
 *
 * Returns the updated state; caller is responsible for persistence.
 */
export function completeExecution(
  state: SchedulerState,
  executionId: string,
  outcome: ExecutionStatus.COMPLETED | ExecutionStatus.FAILED,
  _error: string | null = null,
  now: Date = new Date(),
): SchedulerState {
  const execution = state.activeExecutions.find((e) => e.id === executionId);
  if (!execution) {
    throw new ExecutionNotFoundError(executionId);
  }

  const remainingActive = state.activeExecutions.filter(
    (e) => e.id !== executionId,
  );

  const newWorkflowStatus: ExecutionStatus =
    remainingActive.filter((e) => e.status === ExecutionStatus.RUNNING).length > 0
      ? ExecutionStatus.RUNNING
      : outcome === ExecutionStatus.COMPLETED
        ? ExecutionStatus.NOT_STARTED // ready for next cycle
        : ExecutionStatus.FAILED;

  const updatedWorkflow: Workflow = {
    ...state.workflow,
    execution_status: newWorkflowStatus,
    last_cycle_completed_at: outcome === ExecutionStatus.COMPLETED ? now : state.workflow.last_cycle_completed_at,
    updated_at: now,
  };

  // Advance recurrence date on success
  let updatedTask: Task = {
    ...state.task,
    execution_status: newWorkflowStatus === ExecutionStatus.RUNNING ? ExecutionStatus.RUNNING : ExecutionStatus.NOT_STARTED,
    updated_at: now,
  };
  if (outcome === ExecutionStatus.COMPLETED && updatedTask.is_recurring && updatedTask.recurrence_pattern) {
    updatedTask = {
      ...updatedTask,
      next_recurrence_date: computeNextRecurrenceDate(updatedTask.recurrence_pattern, now),
    };
  }

  return {
    workflow: updatedWorkflow,
    task: updatedTask,
    // activeExecutions holds only running execs; completed/failed records are not re-appended
    activeExecutions: remainingActive,
  };
}

/**
 * Determine whether it is time to trigger the next cycle.
 * Returns true when:
 *   - task.is_recurring is true
 *   - task.next_recurrence_date <= now
 *   - no active (non-orphaned) execution is already running
 */
export function shouldTrigger(
  state: SchedulerState,
  now: Date = new Date(),
): boolean {
  if (!state.task.is_recurring) return false;
  if (!state.task.next_recurrence_date) return true; // trigger immediately if no date set
  if (state.task.next_recurrence_date > now) return false;

  const nonOrphaned = state.activeExecutions.filter(
    (e) =>
      e.status === ExecutionStatus.RUNNING &&
      now.getTime() - e.started_at.getTime() <= EXECUTION_TIMEOUT_MS,
  );
  return nonOrphaned.length === 0;
}

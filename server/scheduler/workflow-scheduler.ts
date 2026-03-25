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
  ExecutionStatus,
  ReconciliationAction,
  ReconciliationResult,
  RecurrencePattern,
  SchedulerState,
  Task,
  Workflow,
} from './types';

/** How long an execution may stay in `running` before it is considered orphaned */
export const EXECUTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Maximum number of simultaneous active executions per task */
export const MAX_CONCURRENT_EXECUTIONS = 1;

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
    case 'hourly':
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * True when the workflow claims to be running but no active execution exists.
 * This is the primary "orchestration drift" symptom described in the issue.
 */
export function hasStateDrift(state: SchedulerState): boolean {
  return (
    state.workflow.execution_status === 'running' &&
    state.activeExecutions.length === 0
  );
}

/**
 * Return all executions that have been running longer than EXECUTION_TIMEOUT_MS.
 * These are "orphaned" – they will never complete on their own.
 */
export function findOrphanedExecutions(
  state: SchedulerState,
  now: Date = new Date(),
): Execution[] {
  return state.activeExecutions.filter(
    (exec) => now.getTime() - exec.started_at.getTime() > EXECUTION_TIMEOUT_MS,
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
    (e) => now.getTime() - e.started_at.getTime() <= EXECUTION_TIMEOUT_MS,
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

  // ── 1. Clear orphaned executions ──────────────────────────────────────────
  const orphaned = findOrphanedExecutions({ workflow, task, activeExecutions }, now);
  if (orphaned.length > 0) {
    const orphanedIds = new Set(orphaned.map((e) => e.id));
    const cancelledOrphans: Execution[] = orphaned.map((e) => ({
      ...e,
      status: 'cancelled' as ExecutionStatus,
      completed_at: now,
      error: `Orphaned: execution exceeded ${EXECUTION_TIMEOUT_MS / 60_000} min timeout`,
    }));

    // Replace active list: remove orphaned entries
    activeExecutions = activeExecutions
      .filter((e) => !orphanedIds.has(e.id))
      .concat(
        // Keep cancelled orphans in the list so callers can persist them
        cancelledOrphans,
      );

    actions.push({
      type: 'clear_orphaned',
      description:
        `Cancelled ${orphaned.length} orphaned execution(s): ` +
        orphaned.map((e) => e.id).join(', '),
    });
  }

  // Active executions after orphan removal (exclude the cancelled ones we just added)
  const stillActiveExecutions = activeExecutions.filter(
    (e) => e.status === 'running',
  );

  // ── 2. Reset workflow state drift ─────────────────────────────────────────
  if (
    workflow.execution_status === 'running' &&
    stillActiveExecutions.length === 0
  ) {
    workflow = {
      ...workflow,
      execution_status: 'not_started',
      updated_at: now,
    };
    actions.push({
      type: 'reset_workflow',
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
      type: 'advance_recurrence',
      description:
        `Stale next_recurrence_date advanced to ${next.toISOString()} ` +
        `(+1 ${task.recurrence_pattern}).`,
    });
  }

  // ── 4. Enforce single scheduler source of truth ──────────────────────────
  if (task.is_recurring && !workflow.is_scheduled) {
    workflow = { ...workflow, is_scheduled: true, updated_at: now };
    actions.push({
      type: 'enable_scheduler',
      description:
        'Task is recurring but workflow.is_scheduled was false. ' +
        'Set is_scheduled=true to enforce single scheduler source of truth.',
    });
  }

  if (actions.length === 0) {
    actions.push({ type: 'none', description: 'State is consistent – no action required.' });
  }

  return {
    actions,
    state: { workflow, task, activeExecutions },
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
    status: 'running',
    started_at: now,
    completed_at: null,
    error: null,
  };

  const updatedWorkflow: Workflow = {
    ...state.workflow,
    execution_status: 'running',
    is_scheduled: true,
    updated_at: now,
  };

  const updatedTask: Task = {
    ...state.task,
    execution_status: 'running',
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
  outcome: 'completed' | 'failed',
  error: string | null = null,
  now: Date = new Date(),
): SchedulerState {
  const execution = state.activeExecutions.find((e) => e.id === executionId);
  if (!execution) {
    throw new Error(`Execution ${executionId} not found in active executions`);
  }

  const completedExecution: Execution = {
    ...execution,
    status: outcome,
    completed_at: now,
    error,
  };

  const remainingActive = state.activeExecutions.filter(
    (e) => e.id !== executionId,
  );

  const newWorkflowStatus: ExecutionStatus =
    remainingActive.filter((e) => e.status === 'running').length > 0
      ? 'running'
      : outcome === 'completed'
        ? 'not_started' // ready for next cycle
        : 'failed';

  const updatedWorkflow: Workflow = {
    ...state.workflow,
    execution_status: newWorkflowStatus,
    last_cycle_completed_at: outcome === 'completed' ? now : state.workflow.last_cycle_completed_at,
    updated_at: now,
  };

  // Advance recurrence date on success
  let updatedTask: Task = {
    ...state.task,
    execution_status: newWorkflowStatus === 'running' ? 'running' : 'not_started',
    updated_at: now,
  };
  if (outcome === 'completed' && updatedTask.is_recurring && updatedTask.recurrence_pattern) {
    updatedTask = {
      ...updatedTask,
      next_recurrence_date: computeNextRecurrenceDate(updatedTask.recurrence_pattern, now),
    };
  }

  return {
    workflow: updatedWorkflow,
    task: updatedTask,
    activeExecutions: [...remainingActive, completedExecution],
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
      e.status === 'running' &&
      now.getTime() - e.started_at.getTime() <= EXECUTION_TIMEOUT_MS,
  );
  return nonOrphaned.length === 0;
}

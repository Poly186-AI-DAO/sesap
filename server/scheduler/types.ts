/**
 * Scheduler State Machine Types
 *
 * Models the Workflow → Task → Execution hierarchy used by the Intent Signal
 * Discovery pipeline and any future recurring workflows.
 *
 * Key invariants:
 *   - A Workflow in RUNNING state MUST have at least one active Execution.
 *     If no active Execution exists the workflow has drifted and must be reset.
 *   - Only one active Execution per Task is allowed at a time
 *     (UserConcurrencyLimitError otherwise).
 *   - task.next_recurrence_date must always be in the future; stale dates must
 *     be auto-advanced to `now + cadence`.
 */

export type ExecutionStatus =
  | 'not_started'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RecurrencePattern = 'hourly' | 'daily' | 'weekly' | 'monthly';

/** Top-level orchestration unit */
export interface Workflow {
  id: string;
  name: string;
  /** Semver-style version string, e.g. "1.0" */
  version: string;
  execution_status: ExecutionStatus;
  /** True when a scheduler (cron / interval) drives this workflow */
  is_scheduled: boolean;
  /** ISO timestamp of the last successfully-completed cycle */
  last_cycle_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** A single schedulable unit within a Workflow */
export interface Task {
  id: string;
  workflow_id: string;
  name: string;
  execution_status: ExecutionStatus;
  /** Whether this task repeats automatically */
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  /** When the task should next fire */
  next_recurrence_date: Date | null;
  last_executed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** A single run of a Task */
export interface Execution {
  id: string;
  task_id: string;
  workflow_id: string;
  status: ExecutionStatus;
  started_at: Date;
  completed_at: Date | null;
  error: string | null;
}

/** Full scheduler state snapshot */
export interface SchedulerState {
  workflow: Workflow;
  task: Task;
  /** All executions that are currently in `running` status */
  activeExecutions: Execution[];
}

/** Describes a single reconciliation action that was (or should be) taken */
export interface ReconciliationAction {
  /**
   * Machine-readable action identifier:
   *   - `none`               – nothing to do
   *   - `reset_workflow`     – workflow RUNNING with no active execution → reset to not_started
   *   - `clear_orphaned`     – timed-out executions cleared
   *   - `advance_recurrence` – stale next_recurrence_date pushed to future
   *   - `enable_scheduler`   – is_scheduled was false, now set to true
   */
  type:
    | 'none'
    | 'reset_workflow'
    | 'clear_orphaned'
    | 'advance_recurrence'
    | 'enable_scheduler';
  description: string;
}

export interface ReconciliationResult {
  actions: ReconciliationAction[];
  state: SchedulerState;
}

/** Result of the concurrency check before starting a new execution */
export interface ConcurrencyCheck {
  allowed: boolean;
  /** Human-readable reason when not allowed */
  reason?: string;
}

/** A monitoring alert emitted when the scheduler detects a problem */
export interface MonitoringAlert {
  type: 'missed_cadence' | 'state_drift' | 'orphaned_execution';
  workflow_id: string;
  task_id?: string;
  execution_id?: string;
  message: string;
  detected_at: Date;
}

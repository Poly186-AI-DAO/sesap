/**
 * Intent Signal Discovery – Workflow Definition
 *
 * Defines the well-known IDs and default state for the Intent Signal Discovery
 * workflow (workflow c10f1d63, task 8c929111) referenced in the issue.
 *
 * This module is the canonical "registry entry" for the workflow.  At runtime
 * the scheduler reads live state from the database/store; this file provides
 * the initial seed state and the constants needed for targeting specific
 * records during reconciliation.
 *
 * Acceptance criteria addressed here
 * ────────────────────────────────────
 * ✅  is_scheduled=true enforced (single scheduler source of truth)
 * ✅  recurrence_pattern=hourly, next_recurrence_date always in the future
 * ✅  execution_status starts as not_started (no false RUNNING idle state)
 * ✅  last_cycle_completed_at tracked so monitoring can fire on cadence miss
 */

import type { SchedulerState, Task, Workflow } from './types';
import { computeNextRecurrenceDate } from './workflow-scheduler';

// ─── Well-known identifiers ───────────────────────────────────────────────────

/** Workflow ID as recorded in Poly Operations */
export const INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID =
  'c10f1d63-0e63-4c03-bfea-aa16c31d2a6a';

/** Version string as recorded in Poly Operations */
export const INTENT_SIGNAL_DISCOVERY_WORKFLOW_VERSION = '1.0';

/** Hourly task ID as recorded in Poly Operations */
export const INTENT_SIGNAL_DISCOVERY_TASK_ID =
  '8c929111-2380-49bb-b07d-e6c2429927c3';

// ─── Seed / reset factory ─────────────────────────────────────────────────────

/**
 * Build the canonical "clean" state for Intent Signal Discovery.
 *
 * Use this to:
 *   - Seed the state store on first run
 *   - Reset a stuck/drifted workflow back to a healthy baseline
 *
 * @param now  Reference time (defaults to Date.now()).  Pass a fixed value in
 *             tests so assertions don't depend on wall-clock time.
 */
export function buildIntentSignalDiscoveryState(
  now: Date = new Date(),
): SchedulerState {
  const workflow: Workflow = {
    id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
    name: 'Intent Signal Discovery',
    version: INTENT_SIGNAL_DISCOVERY_WORKFLOW_VERSION,
    execution_status: 'not_started',
    // Single scheduler source of truth: workflow-level scheduler drives cadence
    is_scheduled: true,
    last_cycle_completed_at: null,
    created_at: now,
    updated_at: now,
  };

  const task: Task = {
    id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
    workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
    name: 'Hourly Intent Signal Scan',
    execution_status: 'not_started',
    is_recurring: true,
    recurrence_pattern: 'hourly',
    // Next fire is 1 hour from now so the first cycle does not trigger immediately
    next_recurrence_date: computeNextRecurrenceDate('hourly', now),
    last_executed_at: null,
    created_at: now,
    updated_at: now,
  };

  return {
    workflow,
    task,
    activeExecutions: [],
  };
}

/**
 * Return true if the given state matches the Intent Signal Discovery
 * workflow/task IDs.  Useful for routing reconciliation calls to the right
 * handler.
 */
export function isIntentSignalDiscoveryState(state: SchedulerState): boolean {
  return (
    state.workflow.id === INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID &&
    state.task.id === INTENT_SIGNAL_DISCOVERY_TASK_ID
  );
}

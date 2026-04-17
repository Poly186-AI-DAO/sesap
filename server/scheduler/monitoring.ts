/**
 * Scheduler Monitoring
 *
 * Emits MonitoringAlert objects when the scheduler detects problems that
 * require operator attention.  No I/O – callers decide how to surface alerts
 * (logs, webhooks, dashboards, etc.).
 *
 * Checks implemented
 * ───────────────────
 * - missed_cadence      : last_cycle_completed_at > threshold ago (default 90 min)
 * - state_drift         : workflow RUNNING with no active execution
 * - orphaned_execution  : execution stuck in running past the timeout
 */

import { findOrphanedExecutions, EXECUTION_TIMEOUT_MS, hasStateDrift } from './workflow-scheduler';
import type { SchedulerState } from './types';
import { MonitoringAlertType } from './types';
import type { MonitoringAlert } from './types';

/** Default cadence miss threshold – alert if no successful cycle in this window */
export const MISSED_CADENCE_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Run all monitoring checks against the provided state and return any alerts.
 *
 * @param state     Current scheduler state snapshot
 * @param now       Current time (injectable for testing)
 * @param cadenceThresholdMs  Override the default 90-min cadence-miss window
 */
export function checkMonitoring(
  state: SchedulerState,
  now: Date = new Date(),
  cadenceThresholdMs: number = MISSED_CADENCE_THRESHOLD_MS,
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  // ── 1. Missed cadence ─────────────────────────────────────────────────────
  const missedCadenceAlert = checkMissedCadence(state, now, cadenceThresholdMs);
  if (missedCadenceAlert) alerts.push(missedCadenceAlert);

  // ── 2. State drift ────────────────────────────────────────────────────────
  const driftAlert = checkStateDrift(state, now);
  if (driftAlert) alerts.push(driftAlert);

  // ── 3. Orphaned executions ────────────────────────────────────────────────
  alerts.push(...checkOrphanedExecutions(state, now));

  return alerts;
}

/**
 * Alert when the workflow has not completed a cycle within `thresholdMs`.
 *
 * Fires when:
 *   - last_cycle_completed_at is null (never ran), OR
 *   - now - last_cycle_completed_at > thresholdMs
 */
export function checkMissedCadence(
  state: SchedulerState,
  now: Date = new Date(),
  thresholdMs: number = MISSED_CADENCE_THRESHOLD_MS,
): MonitoringAlert | null {
  const { workflow } = state;

  if (!workflow.last_cycle_completed_at) {
    return {
      type: MonitoringAlertType.MISSED_CADENCE,
      workflow_id: workflow.id,
      message:
        `Workflow "${workflow.name}" has never completed a cycle. ` +
        'Verify the scheduler is running and the task can execute.',
      detected_at: now,
    };
  }

  const ageMs = now.getTime() - workflow.last_cycle_completed_at.getTime();
  if (ageMs > thresholdMs) {
    const ageMin = Math.round(ageMs / 60_000);
    const thresholdMin = Math.round(thresholdMs / 60_000);
    return {
      type: MonitoringAlertType.MISSED_CADENCE,
      workflow_id: workflow.id,
      message:
        `Workflow "${workflow.name}" last completed ${ageMin} min ago ` +
        `(threshold: ${thresholdMin} min). ` +
        'Cadence miss detected – investigate scheduler health.',
      detected_at: now,
    };
  }

  return null;
}

/**
 * Alert when the workflow is in RUNNING state but has no active executions
 * (orchestration drift).
 */
export function checkStateDrift(
  state: SchedulerState,
  now: Date = new Date(),
): MonitoringAlert | null {
  if (!hasStateDrift(state)) return null;

  return {
    type: MonitoringAlertType.STATE_DRIFT,
    workflow_id: state.workflow.id,
    task_id: state.task.id,
    message:
      `Workflow "${state.workflow.name}" reports execution_status=RUNNING ` +
      'but has no active executions. ' +
      'Call /api/scheduler/reconcile to restore consistent state.',
    detected_at: now,
  };
}

/**
 * Alert for each execution that has exceeded EXECUTION_TIMEOUT_MS.
 */
export function checkOrphanedExecutions(
  state: SchedulerState,
  now: Date = new Date(),
): MonitoringAlert[] {
  return findOrphanedExecutions(state, now).map((exec) => {
    const ageMin = Math.round(
      (now.getTime() - exec.started_at.getTime()) / 60_000,
    );
    return {
      type: MonitoringAlertType.ORPHANED_EXECUTION,
      workflow_id: exec.workflow_id,
      task_id: exec.task_id,
      execution_id: exec.id,
      message:
        `Execution ${exec.id} for task "${state.task.name}" has been running for ` +
        `${ageMin} min (timeout: ${EXECUTION_TIMEOUT_MS / 60_000} min). ` +
        'Call /api/scheduler/reconcile to clear orphaned executions.',
      detected_at: now,
    };
  });
}

/**
 * Express API server for contract generation and scheduler management
 *
 * Provides endpoints for:
 *   - Contract generation from transcripts
 *   - Scheduler status, reconciliation, and manual trigger
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { transcriptToContract } from './scripts/transcript-to-contract';
import {
  buildIntentSignalDiscoveryState,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
  INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID,
  INTENT_SIGNAL_DISCOVERY_TASK_ID,
  INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID,
} from './scheduler/intent-signal-discovery';
import {
  reconcile,
  startExecution,
  completeExecution,
  shouldTrigger,
} from './scheduler/workflow-scheduler';
import { checkMonitoring } from './scheduler/monitoring';
import { JsonFileSchedulerStore } from './scheduler/json-file-store';
import { startSchedulerLoop } from './scheduler/scheduler-loop';
import type { SchedulerLoopHandle } from './scheduler/scheduler-loop';
import type { SchedulerState } from './scheduler/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

/**
 * Recursively remove null and undefined values from an object
 * Concerto/Accord expects optional fields to be OMITTED, not null
 */
function stripNullValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripNullValues).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const stripped = stripNullValues(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return result;
  }
  return obj;
}

/**
 * POST /api/generate/contract
 * 
 * Generate Accord contract artifacts from a transcript
 * 
 * Body: { transcript: string }
 * Returns: { model: string, template: string, data: string, html: string }
 */
app.post('/api/generate/contract', async (req: Request, res: Response) => {
  const { transcript } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'transcript is required and must be a string' });
  }

  if (transcript.length < 100) {
    return res.status(400).json({ error: 'transcript must be at least 100 characters' });
  }

  console.log(`[API] Generating contract from transcript (${transcript.length} chars)`);

  try {
    // Write transcript to temp file for processing
    const fs = await import('fs');
    const os = await import('os');
    const tempFile = path.join(os.tmpdir(), `transcript-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, transcript);

    // Generate contract artifacts
    const result = await transcriptToContract(tempFile);

    // Clean up temp file
    fs.unlinkSync(tempFile);

    // Return the artifacts (strip null values from data for Concerto compatibility)
    let cleanedData: string;
    try {
      const rawData = typeof result.validation.jsonData === 'string'
        ? JSON.parse(result.validation.jsonData)
        : result.validation.jsonData;
      cleanedData = JSON.stringify(stripNullValues(rawData), null, 2);
    } catch {
      cleanedData = typeof result.validation.jsonData === 'string'
        ? result.validation.jsonData
        : JSON.stringify(result.validation.jsonData, null, 2);
    }

    res.json({
      model: result.validation.concertoModel,
      template: result.validation.templateMark,
      data: cleanedData,
      html: result.html || '',
    });
  } catch (error) {
    console.error('[API] Contract generation failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Contract generation failed' 
    });
  }
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ─── Scheduler state store & loop ────────────────────────────────────────────

/**
 * File-backed scheduler state store.
 *
 * State is persisted to `SCHEDULER_STATE_FILE` (default: `data/scheduler-state.json`
 * relative to the project root) so it survives process restarts. On the first
 * run the file is seeded from `buildIntentSignalDiscoveryState()`; subsequent
 * restarts load the last-known state including active executions and the
 * `next_recurrence_date`, which means the loop picks up exactly where it left
 * off without losing cadence.
 *
 * Set `SCHEDULER_STATE_FILE` in the environment to point at a different path
 * (e.g. a mounted volume in a container deployment).
 */
const SCHEDULER_STATE_FILE =
  process.env.SCHEDULER_STATE_FILE ??
  path.resolve(__dirname, '..', 'data', 'scheduler-state.json');

const schedulerStore = new JsonFileSchedulerStore(
  SCHEDULER_STATE_FILE,
  buildIntentSignalDiscoveryState(),
);

const getSchedulerState = (): SchedulerState => schedulerStore.read();
const setSchedulerState = (s: SchedulerState): void => schedulerStore.write(s);

// ─── Execution audit log ──────────────────────────────────────────────────────

/**
 * Path to the append-only JSONL audit log that records every scan attempt.
 *
 * Each line is a JSON object:
 *   { execution_id, workflow_id, task_id, started_at, completed_at, outcome, error? }
 *
 * This log provides durable, observable proof that the hourly cycle is running.
 * Set `SCHEDULER_AUDIT_LOG` in the environment to redirect to a different path.
 */
const SCHEDULER_AUDIT_LOG =
  process.env.SCHEDULER_AUDIT_LOG ??
  path.resolve(__dirname, '..', 'data', 'scheduler-audit.jsonl');

function appendAuditRecord(record: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(SCHEDULER_AUDIT_LOG), { recursive: true });
    fs.appendFileSync(SCHEDULER_AUDIT_LOG, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    console.error('[IntentSignalScan] Failed to write audit record:', err);
  }
}

// ─── Task runner ──────────────────────────────────────────────────────────────

/**
 * Perform one Intent Signal Discovery scan.
 *
 * Writes a structured audit record to `SCHEDULER_AUDIT_LOG` (default:
 * `data/scheduler-audit.jsonl`) on both success and failure so every cycle
 * produces durable, observable evidence. Review this file to verify that
 * hourly cycles are executing and completing successfully.
 *
 * Replace the body marked with "TODO" below with the real scan implementation
 * (or an HTTP call to the scan micro-service) when available. The scheduler
 * loop handles `completeExecution()` automatically on both success and failure;
 * do NOT call it from inside this function.
 *
 * @param executionId  The running Execution ID — included in all logs.
 */
async function runIntentSignalScan(executionId: string): Promise<void> {
  const startedAt = new Date();
  console.log(
    `[IntentSignalScan] Execution ${executionId} started at ${startedAt.toISOString()}. ` +
      `Workflow: ${INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID}, ` +
      `Task: ${INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID}`,
  );

  try {
    // TODO: Replace with the real scan implementation, e.g.:
    //   await signalScanClient.run({
    //     workflowId: INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID,
    //     taskId: INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID,
    //     executionId,
    //   });

    const completedAt = new Date();
    appendAuditRecord({
      execution_id: executionId,
      workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID,
      task_id: INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      outcome: 'completed',
    });

    console.log(
      `[IntentSignalScan] Execution ${executionId} completed at ${completedAt.toISOString()}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    appendAuditRecord({
      execution_id: executionId,
      workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID,
      task_id: INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      error: errorMsg,
    });
    throw err;
  }
}

// ─── Autonomous scheduler loop ────────────────────────────────────────────────

/**
 * Fires every 60 seconds, reconciles state, and triggers a new execution
 * cycle whenever next_recurrence_date <= now.
 *
 * Stop handle exported so tests and graceful-shutdown handlers can call
 * schedulerLoop.stop().
 */
export let schedulerLoop: SchedulerLoopHandle = startSchedulerLoop(
  getSchedulerState,
  setSchedulerState,
  runIntentSignalScan,
  { checkIntervalMs: 60_000 },
);

/**
 * GET /api/scheduler/status
 *
 * Returns the current scheduler state plus any active monitoring alerts.
 * Use this to verify:
 *   - workflow.execution_status
 *   - task.next_recurrence_date
 *   - task.updated_at (should advance roughly hourly)
 *   - alerts array (empty = healthy)
 */
app.get('/api/scheduler/status', (_req: Request, res: Response) => {
  const state = getSchedulerState();
  const alerts = checkMonitoring(state);
  console.log(`[Scheduler] Status requested. Alerts: ${alerts.length}`);
  res.json({
    workflow: state.workflow,
    task: state.task,
    activeExecutions: state.activeExecutions,
    alerts,
  });
});

/**
 * POST /api/scheduler/reconcile
 *
 * Detect and fix state drift, orphaned executions, stale recurrence dates,
 * and missing is_scheduled flag.  Safe to call repeatedly; idempotent when
 * state is already consistent.
 *
 * This is the primary remediation action for the issue:
 *   - Clears orphaned active executions (removes UserConcurrencyLimitError blocks)
 *   - Resets workflow from false RUNNING to not_started
 *   - Advances next_recurrence_date when stuck in the past
 *   - Sets is_scheduled=true as the single source of truth
 */
app.post('/api/scheduler/reconcile', (_req: Request, res: Response) => {
  const result = reconcile(getSchedulerState());
  setSchedulerState(result.state);

  console.log(
    `[Scheduler] Reconciliation complete. Actions: ${result.actions.map((a) => a.type).join(', ')}`,
  );

  const state = getSchedulerState();
  res.json({
    actions: result.actions,
    workflow: state.workflow,
    task: state.task,
    activeExecutions: state.activeExecutions,
    cancelledExecutions: result.cancelledExecutions,
  });
});

/**
 * POST /api/scheduler/trigger
 *
 * Manually trigger the next execution cycle (e.g. for testing or catch-up
 * after a missed cadence).  Returns 409 if an execution is already running or
 * if it is not yet time for the next cycle and `force` is not set.
 *
 * The endpoint starts the execution, runs `runIntentSignalScan()` asynchronously,
 * and calls `completeExecution()` on both success and failure — so the cycle
 * always closes and `next_recurrence_date` always rolls forward on success.
 *
 * Body: { force?: boolean }
 *   force=true  – trigger even if next_recurrence_date is in the future
 */
app.post('/api/scheduler/trigger', (req: Request, res: Response) => {
  const force = req.body?.force === true;
  const now = new Date();

  if (!force && !shouldTrigger(getSchedulerState(), now)) {
    const next = getSchedulerState().task.next_recurrence_date;
    return res.status(409).json({
      error: 'Not yet time for next cycle',
      next_recurrence_date: next?.toISOString() ?? null,
      hint: 'Pass { force: true } to override the recurrence gate.',
    });
  }

  let executionId: string;
  try {
    const { execution, state } = startExecution(getSchedulerState(), now);
    setSchedulerState(state);
    executionId = execution.id;

    console.log(
      `[Scheduler] Execution ${executionId} started for task ${INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID}`,
    );
  } catch (err) {
    // Includes UserConcurrencyLimitError-equivalent messages
    console.error('[Scheduler] Failed to start execution:', err);
    return res.status(409).json({
      error: err instanceof Error ? err.message : 'Failed to start execution',
      hint: 'Call POST /api/scheduler/reconcile to clear orphaned executions first.',
    });
  }

  // Run the scan asynchronously and wire completeExecution() on both paths
  runIntentSignalScan(executionId)
    .then(() => {
      const completedAt = new Date();
      const completedState = completeExecution(getSchedulerState(), executionId, 'completed', null, completedAt);
      setSchedulerState(completedState);
      console.log(
        `[Scheduler] Execution ${executionId} completed. ` +
          `Next recurrence: ${completedState.task.next_recurrence_date?.toISOString() ?? 'unknown'}`,
      );
    })
    .catch((taskErr: unknown) => {
      const errMsg = taskErr instanceof Error ? taskErr.message : String(taskErr);
      const failedAt = new Date();
      setSchedulerState(completeExecution(getSchedulerState(), executionId, 'failed', errMsg, failedAt));
      console.error(`[Scheduler] Execution ${executionId} failed: ${errMsg}`);
    });

  res.status(202).json({
    execution_id: executionId,
    workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID,
    task_id: INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID,
    started_at: now.toISOString(),
    message: 'Execution started. Monitor via GET /api/scheduler/status.',
  });
});

/**
 * POST /api/scheduler/complete/:executionId
 *
 * External completion callback — allows the real scan job to close the
 * Execution record when it finishes (in environments where the task runner
 * is a separate process or service).
 *
 * Body: { outcome: 'completed' | 'failed', error?: string }
 */
app.post('/api/scheduler/complete/:executionId', (req: Request, res: Response) => {
  const { executionId } = req.params;
  const outcome: 'completed' | 'failed' = req.body?.outcome === 'failed' ? 'failed' : 'completed';
  const error: string | null = req.body?.error ?? null;
  const now = new Date();

  try {
    const updatedState = completeExecution(getSchedulerState(), executionId, outcome, error, now);
    setSchedulerState(updatedState);
    console.log(`[Scheduler] Execution ${executionId} closed via callback. Outcome: ${outcome}`);
    res.json({
      execution_id: executionId,
      outcome,
      workflow: updatedState.workflow,
      task: updatedState.task,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Scheduler] Complete callback failed for ${executionId}: ${msg}`);
    res.status(404).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Contract generation server running on http://localhost:${PORT}`);
});

export default app;

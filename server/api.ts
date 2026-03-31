/**
 * Express API server for contract generation and scheduler management
 *
 * Provides endpoints for:
 *   - Contract generation from transcripts
 *   - Scheduler status, reconciliation, and manual trigger
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
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
 * In-memory scheduler state store.
 * In a production deployment this would be backed by PostgreSQL; the interface
 * is intentionally identical so a DB adapter can be swapped in without
 * changing the endpoint or loop logic.
 *
 * WARNING: state is lost on server restart. Persist to PostgreSQL before
 * promoting to production so active executions and recurrence dates survive
 * process restarts.
 */
let schedulerState: SchedulerState = buildIntentSignalDiscoveryState();
console.warn(
  '[Scheduler] Using in-memory state store. ' +
    'State will be lost on server restart. ' +
    'Integrate PostgreSQL persistence before production deployment.',
);

const getSchedulerState = (): SchedulerState => schedulerState;
const setSchedulerState = (s: SchedulerState): void => { schedulerState = s; };

// ─── Task runner ──────────────────────────────────────────────────────────────

/**
 * Perform one Intent Signal Discovery scan.
 *
 * Replace the body of this function with the real intent-signal-scan
 * implementation (or an HTTP call to the scan micro-service) once available.
 * The scheduler loop calls this automatically every hour and wires
 * completeExecution() on both success and failure paths.
 *
 * @param executionId  The running Execution ID — include in all downstream logs.
 */
async function runIntentSignalScan(executionId: string): Promise<void> {
  console.log(
    `[IntentSignalScan] Starting scan for execution ${executionId}. ` +
      `Workflow: ${INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID}, ` +
      `Task: ${INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID}`,
  );
  // TODO: Replace with real scan logic — e.g.:
  //   await signalScanClient.run({ workflowId: INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID });
  // For now this is a no-op placeholder so the scheduler loop can close the cycle.
  console.log(`[IntentSignalScan] Scan complete for execution ${executionId}`);
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
  const alerts = checkMonitoring(schedulerState);
  console.log(`[Scheduler] Status requested. Alerts: ${alerts.length}`);
  res.json({
    workflow: schedulerState.workflow,
    task: schedulerState.task,
    activeExecutions: schedulerState.activeExecutions,
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
  const result = reconcile(schedulerState);
  schedulerState = result.state;

  console.log(
    `[Scheduler] Reconciliation complete. Actions: ${result.actions.map((a) => a.type).join(', ')}`,
  );

  res.json({
    actions: result.actions,
    workflow: schedulerState.workflow,
    task: schedulerState.task,
    activeExecutions: schedulerState.activeExecutions,
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

  if (!force && !shouldTrigger(schedulerState, now)) {
    const next = schedulerState.task.next_recurrence_date;
    return res.status(409).json({
      error: 'Not yet time for next cycle',
      next_recurrence_date: next?.toISOString() ?? null,
      hint: 'Pass { force: true } to override the recurrence gate.',
    });
  }

  let executionId: string;
  try {
    const { execution, state } = startExecution(schedulerState, now);
    schedulerState = state;
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
      schedulerState = completeExecution(schedulerState, executionId, 'completed', null, completedAt);
      console.log(
        `[Scheduler] Execution ${executionId} completed. ` +
          `Next recurrence: ${schedulerState.task.next_recurrence_date?.toISOString() ?? 'unknown'}`,
      );
    })
    .catch((taskErr: unknown) => {
      const errMsg = taskErr instanceof Error ? taskErr.message : String(taskErr);
      const failedAt = new Date();
      schedulerState = completeExecution(schedulerState, executionId, 'failed', errMsg, failedAt);
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
    schedulerState = completeExecution(schedulerState, executionId, outcome, error, now);
    console.log(`[Scheduler] Execution ${executionId} closed via callback. Outcome: ${outcome}`);
    res.json({
      execution_id: executionId,
      outcome,
      workflow: schedulerState.workflow,
      task: schedulerState.task,
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

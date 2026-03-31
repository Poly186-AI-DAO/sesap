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
  INTENT_SIGNAL_DISCOVERY_TASK_ID,
} from './scheduler/intent-signal-discovery';
import { reconcile, startExecution, shouldTrigger } from './scheduler/workflow-scheduler';
import { checkMonitoring } from './scheduler/monitoring';
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

// ─── Scheduler endpoints ──────────────────────────────────────────────────────

/**
 * In-memory scheduler state store.
 * In a production deployment this would be backed by PostgreSQL; the interface
 * is intentionally identical so a DB adapter can be swapped in without
 * changing the endpoint logic.
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

  try {
    const { execution, state } = startExecution(schedulerState, now);
    schedulerState = state;

    console.log(
      `[Scheduler] Execution ${execution.id} started for task ${INTENT_SIGNAL_DISCOVERY_TASK_ID}`,
    );

    // NOTE: In production, dispatch the actual intent-signal scan here.
    // The execution ID should be passed to the background job so it can call
    // completeExecution() when the scan finishes.

    res.status(202).json({
      execution_id: execution.id,
      workflow_id: INTENT_SIGNAL_DISCOVERY_WORKFLOW_ID,
      task_id: INTENT_SIGNAL_DISCOVERY_TASK_ID,
      started_at: execution.started_at.toISOString(),
      message: 'Execution started. Monitor via GET /api/scheduler/status.',
    });
  } catch (err) {
    // Includes UserConcurrencyLimitError-equivalent messages
    console.error('[Scheduler] Failed to start execution:', err);
    res.status(409).json({
      error: err instanceof Error ? err.message : 'Failed to start execution',
      hint: 'Call POST /api/scheduler/reconcile to clear orphaned executions first.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`[API] Contract generation server running on http://localhost:${PORT}`);
});

export default app;

# Scheduler Persistence Adapter

This document describes how the scheduler state store maps to Poly Operations
production state, and provides the wiring plan for when PostgreSQL integration
lands.

---

## Current implementation (`JsonFileSchedulerStore`)

`server/scheduler/json-file-store.ts` persists `SchedulerState` to a JSON file
(`data/scheduler-state.json`) with atomic writes (temp file → rename). The
store is consumed exclusively through two accessors injected into the scheduler
loop and all API endpoints:

```ts
const getSchedulerState = (): SchedulerState => schedulerStore.read();
const setSchedulerState = (s: SchedulerState) => schedulerStore.write(s);
```

This interface is intentionally identical to what a PostgreSQL adapter would
expose. No other code in the API or scheduler loop references the store
directly — **swapping the backing store requires changing only this wiring in
`server/api.ts`**.

### Relationship to Poly Operations state

| Poly Operations field                   | `SchedulerState` field                               | Notes |
|-----------------------------------------|------------------------------------------------------|-------|
| `workflow.id` (`c10f1d63…::1.0`)        | `state.workflow.id`                                  | Set by `INTENT_SIGNAL_DISCOVERY_WORKFLOW_FULL_ID` |
| `workflow.execution_status`             | `state.workflow.execution_status`                    | `'not_started'` ↔ `'running'` ↔ `'failed'` |
| `workflow.is_scheduled`                 | `state.workflow.is_scheduled`                        | Enforced `true` by `reconcile()` |
| `task.id` (`8c929111…::1.0`)            | `state.task.id`                                      | Set by `INTENT_SIGNAL_DISCOVERY_TASK_FULL_ID` |
| `task.is_recurring`                     | `state.task.is_recurring`                            | Always `true` |
| `task.next_recurrence_date`             | `state.task.next_recurrence_date`                    | Advanced to `completed_at + 1h` after every successful cycle |
| `task.updated_at`                       | `state.task.updated_at`                              | Updated on every `startExecution` / `completeExecution` |
| Active `TaskExecution` rows             | `state.activeExecutions[]`                           | Strictly running-only; orphans cleared by `reconcile()` |
| `TaskExecution.execution_status`        | `execution.status`                                   | `'running'` → `'completed'` / `'failed'` / `'cancelled'` |

### What reconcile() heals

`reconcile()` is called on every scheduler tick (every 60 seconds). It
replays the same repair that would be applied to real persisted rows:

1. **Orphaned executions** — any `status === 'running'` execution older than
   30 minutes is cancelled and removed from `activeExecutions`. This unblocks
   the `UserConcurrencyLimitError` gate.
2. **False-RUNNING workflow** — if `workflow.execution_status === 'running'`
   but `activeExecutions` contains zero running entries, the workflow is reset
   to `'not_started'`.
3. **Stale `next_recurrence_date`** — if the date is in the past, it is
   advanced in one-hour steps until it is in the future, restoring cadence
   continuity after a crash or long idle.
4. **`is_scheduled` drift** — `workflow.is_scheduled` is unconditionally set
   to `true` (mirrors the Poly Operations incident where the field had drifted
   to `false`).

---

## Migration path: JSON file → PostgreSQL

When PostgreSQL integration lands (`docs/WIP_MCP_STATUS.md`), the adapter
swap is a single edit in `server/api.ts`:

### Step 1 — Implement `PostgresSchedulerStore`

Create `server/scheduler/postgres-store.ts` with the same two-method interface:

```ts
export class PostgresSchedulerStore {
  async read(): Promise<SchedulerState> {
    // SELECT workflow, task, active executions from DB
    // Map rows → SchedulerState
  }

  async write(state: SchedulerState): Promise<void> {
    // Upsert workflow row
    // Upsert task row
    // Upsert / delete execution rows to match state.activeExecutions
  }
}
```

The `read()` method maps real `TaskExecution` rows to `Execution` objects using
the same field names defined in `server/scheduler/types.ts`. Orphan detection,
concurrency gating, and recurrence advancement all operate on the in-memory
`SchedulerState` object — the store only handles persistence.

### Step 2 — Swap the wiring in `server/api.ts`

Replace the `JsonFileSchedulerStore` block (~10 lines) with:

```ts
import { PostgresSchedulerStore } from './scheduler/postgres-store';

const schedulerStore = new PostgresSchedulerStore(dbPool);
const getSchedulerState = async (): Promise<SchedulerState> => schedulerStore.read();
const setSchedulerState = async (s: SchedulerState): Promise<void> => schedulerStore.write(s);
```

The scheduler loop and all four API endpoints (`/status`, `/reconcile`,
`/trigger`, `/complete/:id`) receive `getSchedulerState`/`setSchedulerState` as
injected dependencies — they continue to work without any changes.

### Step 3 — No other files change

All scheduler logic (`workflow-scheduler.ts`, `monitoring.ts`,
`scheduler-loop.ts`, `intent-signal-discovery.ts`) operates on plain
`SchedulerState` objects. The pure-function design means none of those files
reference the store type.

---

## Audit log

`runIntentSignalScan()` appends a JSONL record to `data/scheduler-audit.jsonl`
on every execution attempt (success or failure):

```jsonl
{"execution_id":"…","workflow_id":"c10f1d63…::1.0","task_id":"8c929111…::1.0","started_at":"…","completed_at":"…","outcome":"completed"}
```

This file is the durable, observable proof that hourly cycles are executing.
In a PostgreSQL environment this record should also be written to a
`scheduler_audit` table so it survives across container restarts.

---

## Related files

| File | Role |
|------|------|
| `server/scheduler/types.ts` | `SchedulerState`, `Workflow`, `Task`, `Execution` types |
| `server/scheduler/workflow-scheduler.ts` | Pure scheduler logic (no I/O) |
| `server/scheduler/json-file-store.ts` | Current persistence adapter |
| `server/scheduler/scheduler-loop.ts` | `setInterval` daemon; injects store accessors |
| `server/scheduler/intent-signal-discovery.ts` | Seed factory; exports canonical `::1.0` IDs |
| `server/api.ts` | Wires store → loop; houses `runIntentSignalScan()` |
| `src/tests/scheduler/scheduler-integration.test.ts` | End-to-end lifecycle tests including 6-hour simulation |

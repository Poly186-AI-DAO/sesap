/**
 * JSON File-based Scheduler State Store
 *
 * Persists SchedulerState to disk as JSON so state survives process restarts.
 * On startup, reads existing state from the file (or seeds from the provided
 * factory if the file is absent or corrupt). On every write, state is
 * serialized atomically: written to a temp file then renamed into place.
 *
 * This is structurally identical to what a PostgreSQL adapter would expose.
 * The `getState`/`setState` interface used by the scheduler loop and API
 * endpoints does not change when the backing store is swapped — only this
 * file needs updating when PostgreSQL integration lands.
 *
 * Usage
 * ─────
 *   const store = new JsonFileSchedulerStore('/var/data/scheduler-state.json', seedState);
 *   const getState = () => store.read();
 *   const setState = (s: SchedulerState) => store.write(s);
 *   startSchedulerLoop(getState, setState, runTask);
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { SchedulerState } from './types';

// ─── Serialization helpers ────────────────────────────────────────────────────

/**
 * Date fields present anywhere in a SchedulerState tree.
 * Used by the deserializer to convert ISO strings back to Date objects.
 */
const DATE_FIELDS = new Set([
  'last_cycle_completed_at',
  'created_at',
  'updated_at',
  'next_recurrence_date',
  'last_executed_at',
  'started_at',
  'completed_at',
]);

/** Recursively convert ISO date strings to Date objects after JSON.parse */
function reviveDates(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DATE_FIELDS.has(key) && typeof value === 'string') {
      result[key] = new Date(value);
    } else {
      result[key] = reviveDates(value);
    }
  }
  return result;
}

// ─── JSON replacer ────────────────────────────────────────────────────────────

/** JSON replacer that serializes Date objects as ISO strings */
function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Serialize a SchedulerState to a JSON string, converting Date objects to
 * ISO strings.  This is the same serialization performed by the file store
 * when writing to disk.
 *
 * Exported for use in tests that want to verify the serialization round-trip
 * without performing actual file I/O.
 */
export function serializeSchedulerState(state: SchedulerState): string {
  return JSON.stringify(state, dateReplacer, 2);
}

/**
 * Deserialize a JSON string back to a SchedulerState, converting ISO date
 * strings back to Date objects.  This is the same deserialization performed
 * by the file store when reading from disk.
 *
 * Exported for use in tests that want to verify the serialization round-trip
 * without performing actual file I/O.
 */
export function deserializeSchedulerState(json: string): SchedulerState {
  return reviveDates(JSON.parse(json)) as SchedulerState;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * File-backed scheduler state store.
 *
 * The file is written atomically: state is serialized to a `.tmp` file in the
 * same directory, then renamed over the target path so readers never see a
 * half-written file.
 */
export class JsonFileSchedulerStore {
  private readonly filePath: string;
  private state: SchedulerState;

  /**
   * @param filePath   Absolute path to the JSON state file.
   * @param seedState  State to use when the file does not exist or is corrupt.
   */
  constructor(filePath: string, seedState: SchedulerState) {
    this.filePath = filePath;
    this.state = this.loadOrSeed(seedState);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /** Return the current in-memory state snapshot. */
  read(): SchedulerState {
    return this.state;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Persist an updated state snapshot.
   * Updates the in-memory cache and writes to disk atomically.
   */
  write(state: SchedulerState): void {
    this.state = state;
    this.flush(state);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * Attempt to read state from disk; fall back to `seedState` on any error.
   * Writes the seed state to disk when the file is absent so subsequent
   * restarts find a valid file.
   */
  private loadOrSeed(seedState: SchedulerState): SchedulerState {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        const loaded = reviveDates(raw) as SchedulerState;
        console.log(`[JsonFileStore] Loaded scheduler state from ${this.filePath}`);
        return loaded;
      }
    } catch (err) {
      console.warn(
        `[JsonFileStore] Could not read state from ${this.filePath}; seeding from default:`,
        err,
      );
    }

    // File absent or corrupt: persist the seed state so the next restart picks
    // it up without having to re-seed.
    this.flush(seedState);
    console.log(`[JsonFileStore] Seeded scheduler state at ${this.filePath}`);
    return seedState;
  }

  /**
   * Write state to a temp file then rename into place.
   * This ensures the file is never partially written from the reader's perspective.
   */
  private flush(state: SchedulerState): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Write to a temp path in the same directory so rename is atomic on
    // POSIX file systems (same mount point).
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, dateReplacer, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }
}

// ─── JSON replacer ────────────────────────────────────────────────────────────
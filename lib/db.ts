import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AtsType, Job, NormalizedJob, Source, SourceStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "jobs.db");

let db: Database.Database | null = null;

function init(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      ats_type TEXT NOT NULL,
      ats_identifier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_fetched_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      department TEXT,
      url TEXT NOT NULL,
      posted_at TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE (source_id, external_id),
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);
  `);

  return database;
}

export function getDb(): Database.Database {
  if (!db) db = init();
  return db;
}

// ---------- Sources ----------

export interface NewSource {
  name: string;
  url: string;
  ats_type: AtsType;
  ats_identifier: string;
}

export function listSources(): Source[] {
  return getDb()
    .prepare("SELECT * FROM sources ORDER BY name COLLATE NOCASE ASC")
    .all() as Source[];
}

export function getSource(id: number): Source | undefined {
  return getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id) as
    | Source
    | undefined;
}

export function findSourceByUrl(url: string): Source | undefined {
  return getDb().prepare("SELECT * FROM sources WHERE url = ?").get(url) as
    | Source
    | undefined;
}

export function insertSource(s: NewSource): Source {
  const info = getDb()
    .prepare(
      `INSERT INTO sources (name, url, ats_type, ats_identifier, status)
       VALUES (@name, @url, @ats_type, @ats_identifier, 'pending')`
    )
    .run(s);
  return getSource(Number(info.lastInsertRowid))!;
}

export function deleteSource(id: number): void {
  getDb().prepare("DELETE FROM sources WHERE id = ?").run(id);
}

export function updateSourceStatus(
  id: number,
  status: SourceStatus,
  error: string | null
): void {
  getDb()
    .prepare(
      `UPDATE sources
       SET status = ?, last_error = ?, last_fetched_at = datetime('now')
       WHERE id = ?`
    )
    .run(status, error, id);
}

// ---------- Jobs ----------

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Collapse a job's locations into a single readable, de-duplicated string for
 * storage. The location filter substring-matches against this value, so all of
 * a role's locations become searchable. Falls back to the single `location`.
 */
function joinLocations(j: NormalizedJob): string | null {
  const list = (j.locations ?? [])
    .map((l) => (l ?? "").trim())
    .filter((l) => l.length > 0);
  if (list.length > 0) {
    return Array.from(new Set(list)).join("; ");
  }
  return j.location?.trim() || null;
}

/**
 * Upsert a batch of jobs for a source. Existing jobs (matched by external_id)
 * have last_seen_at refreshed; new jobs get first_seen_at = now. Jobs that were
 * previously active but not present in this batch are marked inactive.
 */
export function upsertJobs(
  sourceId: number,
  company: string,
  jobs: NormalizedJob[]
): UpsertResult {
  const database = getDb();

  const existingRows = database
    .prepare("SELECT external_id FROM jobs WHERE source_id = ?")
    .all(sourceId) as { external_id: string }[];
  const existing = new Set(existingRows.map((r) => r.external_id));

  const upsert = database.prepare(`
    INSERT INTO jobs (source_id, external_id, title, company, location, department, url, posted_at, last_seen_at, is_active)
    VALUES (@source_id, @external_id, @title, @company, @location, @department, @url, @posted_at, datetime('now'), 1)
    ON CONFLICT(source_id, external_id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      department = excluded.department,
      url = excluded.url,
      posted_at = COALESCE(excluded.posted_at, jobs.posted_at),
      last_seen_at = datetime('now'),
      is_active = 1
  `);

  let inserted = 0;
  let updated = 0;
  const seen = new Set<string>();

  const runBatch = database.transaction((rows: NormalizedJob[]) => {
    for (const j of rows) {
      if (!j.externalId || !j.title || !j.url) continue;
      seen.add(j.externalId);
      upsert.run({
        source_id: sourceId,
        external_id: j.externalId,
        title: j.title,
        company,
        location: joinLocations(j),
        department: j.department ?? null,
        url: j.url,
        posted_at: j.postedAt ?? null,
      });
      if (existing.has(j.externalId)) updated++;
      else inserted++;
    }

    // Deactivate jobs no longer present in the source.
    const stale = [...existing].filter((id) => !seen.has(id));
    if (stale.length) {
      const placeholders = stale.map(() => "?").join(",");
      database
        .prepare(
          `UPDATE jobs SET is_active = 0 WHERE source_id = ? AND external_id IN (${placeholders})`
        )
        .run(sourceId, ...stale);
    }
  });

  runBatch(jobs);
  return { inserted, updated };
}

export interface JobFilters {
  search?: string;
  sourceIds?: number[];
  location?: string;
  postedFrom?: string;
  postedTo?: string;
  newSince?: string;
  includeInactive?: boolean;
}

export interface JobWithSource extends Job {
  ats_type: AtsType;
  source_name: string;
}

export function queryJobs(filters: JobFilters): JobWithSource[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!filters.includeInactive) clauses.push("j.is_active = 1");

  if (filters.search) {
    clauses.push("(j.title LIKE ? OR j.company LIKE ? OR j.department LIKE ?)");
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }
  if (filters.location) {
    clauses.push("j.location LIKE ?");
    params.push(`%${filters.location}%`);
  }
  if (filters.sourceIds && filters.sourceIds.length) {
    clauses.push(`j.source_id IN (${filters.sourceIds.map(() => "?").join(",")})`);
    params.push(...filters.sourceIds);
  }
  if (filters.postedFrom) {
    clauses.push("COALESCE(j.posted_at, j.first_seen_at) >= ?");
    params.push(filters.postedFrom);
  }
  if (filters.postedTo) {
    clauses.push("COALESCE(j.posted_at, j.first_seen_at) <= ?");
    params.push(filters.postedTo);
  }
  if (filters.newSince) {
    clauses.push("j.first_seen_at >= ?");
    params.push(filters.newSince);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
    SELECT j.*, s.ats_type AS ats_type, s.name AS source_name
    FROM jobs j
    JOIN sources s ON s.id = j.source_id
    ${where}
    ORDER BY COALESCE(j.posted_at, j.first_seen_at) DESC, j.id DESC
  `;
  return getDb().prepare(sql).all(...params) as JobWithSource[];
}

/** Most recent refresh timestamp across all sources. */
export function lastRefreshedAt(): string | null {
  const row = getDb()
    .prepare("SELECT MAX(last_fetched_at) AS ts FROM sources")
    .get() as { ts: string | null };
  return row?.ts ?? null;
}

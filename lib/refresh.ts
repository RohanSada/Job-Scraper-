import { fetchJobsFor } from "./ats";
import {
  getSource,
  listSources,
  markRefreshStarted,
  updateSourceStatus,
  upsertJobs,
  type NewSource,
} from "./db";
import type { Source } from "./types";

export interface SourceRefreshResult {
  sourceId: number;
  name: string;
  status: "ok" | "error";
  inserted: number;
  updated: number;
  total: number;
  error?: string;
}

export async function refreshSource(source: Source): Promise<SourceRefreshResult> {
  try {
    const { jobs, companyName } = await fetchJobsFor(
      source.ats_type,
      source.ats_identifier
    );
    const company = companyName || source.name;
    const { inserted, updated } = upsertJobs(source.id, company, jobs);
    updateSourceStatus(source.id, "ok", null);
    return {
      sourceId: source.id,
      name: source.name,
      status: "ok",
      inserted,
      updated,
      total: jobs.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateSourceStatus(source.id, "error", message);
    return {
      sourceId: source.id,
      name: source.name,
      status: "error",
      inserted: 0,
      updated: 0,
      total: 0,
      error: message,
    };
  }
}

export async function refreshAll(): Promise<SourceRefreshResult[]> {
  const sources = listSources();
  // Capture the start BEFORE fetching so every job inserted during this run
  // counts as "new this refresh" (see markRefreshStarted).
  markRefreshStarted();
  // Run sequentially-ish but with limited concurrency to be polite to sites.
  return runWithConcurrency(sources, 4, refreshSource);
}

export async function refreshOne(
  id: number
): Promise<SourceRefreshResult | null> {
  const source = getSource(id);
  if (!source) return null;
  return refreshSource(source);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(runners);
  return results;
}

export type { NewSource };

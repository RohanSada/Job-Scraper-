import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchJson } from "./http";

// Workday hosts look like: <tenant>.wd<N>.myworkdayjobs.com
const HOST_RE = /\.myworkdayjobs\.com$/i;

/** identifier encodes everything needed to build the CXS endpoint. */
function encodeId(host: string, tenant: string, site: string): string {
  return `${host}|${tenant}|${site}`;
}

function decodeId(identifier: string): { host: string; tenant: string; site: string } {
  const [host, tenant, site] = identifier.split("|");
  return { host, tenant, site };
}

export function detect(u: URL): Detection | null {
  if (!HOST_RE.test(u.hostname)) return null;
  const tenant = u.hostname.split(".")[0];
  const parts = u.pathname.split("/").filter(Boolean);
  // Drop a leading locale segment like "en-US".
  const filtered = parts.filter((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p));
  const site = filtered[0];
  if (!tenant || !site) return null;
  return {
    atsType: "workday",
    identifier: encodeId(u.hostname, tenant, site),
    suggestedName: prettify(tenant),
    confidence: "high",
  };
}

interface WdResponse {
  total: number;
  jobPostings: {
    title?: string;
    externalPath?: string;
    locationsText?: string;
    postedOn?: string;
    bulletFields?: string[];
  }[];
}

// Workday's list endpoint returns "2 Locations" instead of real names for
// multi-location roles. Detect that so we can fetch the real ones per job.
const MULTI_LOCATION_RE = /^\d+\s+locations?$/i;
const DETAIL_CONCURRENCY = 5;

interface WdJobDetail {
  jobPostingInfo?: {
    location?: string;
    additionalLocations?: string[];
  };
}

export async function fetchJobs(identifier: string): Promise<FetchResult> {
  const { host, tenant, site } = decodeId(identifier);
  const endpoint = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  const jobs: NormalizedJob[] = [];
  // Jobs whose locations must be resolved via a per-job detail call.
  const pending: { job: NormalizedJob; path: string }[] = [];
  const limit = 20;
  let offset = 0;
  let total = Infinity;

  for (let guard = 0; guard < 100 && offset < total; guard++) {
    const data = await fetchJson<WdResponse>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: "" }),
    });
    total = data.total ?? 0;
    for (const p of data.jobPostings ?? []) {
      // Some postings omit externalPath; guard against it and skip those that
      // have neither a path nor a stable id/title we can use.
      const rawPath = p.externalPath ?? "";
      const path = rawPath
        ? rawPath.startsWith("/")
          ? rawPath
          : `/${rawPath}`
        : "";
      const externalId = p.bulletFields?.[0] || path || p.title || "";
      if (!externalId || !p.title) continue;
      const locationsText = p.locationsText?.trim() || null;
      const isMulti = locationsText != null && MULTI_LOCATION_RE.test(locationsText);
      const job: NormalizedJob = {
        externalId,
        title: p.title,
        url: path ? `https://${host}/${site}${path}` : `https://${host}/${site}`,
        locations: locationsText && !isMulti ? [locationsText] : [],
        location: locationsText,
        department: null,
        postedAt: parsePostedOn(p.postedOn),
      };
      jobs.push(job);
      // Only attempt per-job location resolution when we have a real path.
      if (isMulti && path) pending.push({ job, path });
    }
    if (!data.jobPostings || data.jobPostings.length < limit) break;
    offset += limit;
  }

  // Resolve real locations for the "N Locations" roles via the detail endpoint.
  await runWithConcurrency(pending, DETAIL_CONCURRENCY, async ({ job, path }) => {
    try {
      const detail = await fetchJson<WdJobDetail>(
        `https://${host}/wday/cxs/${tenant}/${site}${path}`
      );
      const info = detail.jobPostingInfo;
      const resolved = [info?.location, ...(info?.additionalLocations ?? [])]
        .map((l) => (l ?? "").trim())
        .filter(Boolean);
      job.locations = resolved.length
        ? resolved
        : job.location
          ? [job.location]
          : [];
    } catch {
      // Fall back to the summary text if the detail call fails.
      job.locations = job.location ? [job.location] : [];
    }
  });

  return { jobs, companyName: prettify(tenant) };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        const current = index++;
        await worker(items[current]);
      }
    }
  );
  await Promise.all(runners);
}

// Workday returns strings like "Posted Today", "Posted 5 Days Ago". These are
// relative, so we only convert the ones we can reason about; otherwise null.
function parsePostedOn(text?: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes("today")) return now.toISOString();
  if (lower.includes("yesterday")) {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }
  const m = lower.match(/(\d+)\+?\s*day/);
  if (m) {
    now.setDate(now.getDate() - Number(m[1]));
    return now.toISOString();
  }
  const mo = lower.match(/(\d+)\+?\s*month/);
  if (mo) {
    now.setMonth(now.getMonth() - Number(mo[1]));
    return now.toISOString();
  }
  return null;
}

function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

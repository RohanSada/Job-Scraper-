import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchJson } from "./http";

const HOST_RE = /(?:^|\.)ashbyhq\.com$/i;

export function detect(u: URL): Detection | null {
  if (!HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const company = parts[0];
  if (!company) return null;
  return {
    atsType: "ashby",
    identifier: company,
    suggestedName: prettify(company),
    confidence: "high",
  };
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl?: string;
  applyUrl?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  department?: string;
  team?: string;
  publishedAt?: string;
  updatedAt?: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

export async function fetchJobs(identifier: string): Promise<FetchResult> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
    identifier
  )}?includeCompensation=false`;
  const data = await fetchJson<AshbyResponse>(url);
  const jobs: NormalizedJob[] = (data.jobs ?? []).map((j) => ({
    externalId: j.id,
    title: j.title,
    url: j.jobUrl ?? j.applyUrl ?? "",
    locations: extractLocations(j),
    department: j.department ?? j.team ?? null,
    postedAt: j.publishedAt ?? j.updatedAt ?? null,
  }));
  return { jobs, companyName: prettify(identifier) };
}

function extractLocations(j: AshbyJob): string[] {
  const list = [
    j.location,
    ...(j.secondaryLocations ?? []).map((s) => s.location),
  ]
    .map((l) => (l ?? "").trim())
    .filter(Boolean);
  return list;
}

function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

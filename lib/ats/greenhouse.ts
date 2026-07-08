import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchJson } from "./http";

// Matches boards.greenhouse.io/<token>, job-boards.greenhouse.io/<token>,
// and embedded board tokens.
const HOST_RE = /(?:^|\.)greenhouse\.io$/i;

export function detect(u: URL): Detection | null {
  if (!HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // boards.greenhouse.io/acme  OR  job-boards.greenhouse.io/acme
  const token = parts[0];
  if (!token) return null;
  return {
    atsType: "greenhouse",
    identifier: token,
    suggestedName: prettify(token),
    confidence: "high",
  };
}

interface GhResponse {
  jobs: {
    id: number;
    title: string;
    absolute_url: string;
    updated_at?: string;
    location?: { name?: string };
    offices?: { name?: string }[];
    departments?: { name?: string }[];
  }[];
}

export async function fetchJobs(identifier: string): Promise<FetchResult> {
  // content=true is required for the API to include the per-office `offices[]`
  // array, which holds the real locations for multi-location roles.
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    identifier
  )}/jobs?content=true`;
  const data = await fetchJson<GhResponse>(url);
  const jobs: NormalizedJob[] = (data.jobs ?? []).map((j) => ({
    externalId: String(j.id),
    title: j.title,
    url: j.absolute_url,
    locations: extractLocations(j),
    department: j.departments?.[0]?.name ?? null,
    postedAt: j.updated_at ?? null,
  }));
  return { jobs, companyName: prettify(identifier) };
}

function extractLocations(j: GhResponse["jobs"][number]): string[] {
  const fromOffices = (j.offices ?? [])
    .map((o) => o.name?.trim() ?? "")
    .filter(Boolean);
  if (fromOffices.length > 0) return fromOffices;
  // Fallback: location.name can itself be a "; "-joined list of locations.
  const name = j.location?.name?.trim();
  if (!name) return [];
  return name
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

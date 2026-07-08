import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchJson } from "./http";

const HOST_RE = /(?:^|\.)lever\.co$/i;

export function detect(u: URL): Detection | null {
  if (!HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const company = parts[0];
  if (!company) return null;
  return {
    atsType: "lever",
    identifier: company,
    suggestedName: prettify(company),
    confidence: "high",
  };
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: {
    location?: string;
    allLocations?: string[];
    team?: string;
    department?: string;
  };
}

export async function fetchJobs(identifier: string): Promise<FetchResult> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(
    identifier
  )}?mode=json`;
  const data = await fetchJson<LeverPosting[]>(url);
  const jobs: NormalizedJob[] = (data ?? []).map((j) => ({
    externalId: j.id,
    title: j.text,
    url: j.hostedUrl,
    locations: extractLocations(j),
    department: j.categories?.team ?? j.categories?.department ?? null,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
  }));
  return { jobs, companyName: prettify(identifier) };
}

function extractLocations(j: LeverPosting): string[] {
  const all = (j.categories?.allLocations ?? [])
    .map((l) => (l ?? "").trim())
    .filter(Boolean);
  if (all.length > 0) return all;
  const single = j.categories?.location?.trim();
  return single ? [single] : [];
}

function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

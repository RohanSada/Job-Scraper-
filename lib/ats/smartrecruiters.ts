import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchJson } from "./http";

const HOST_RE = /(?:^|\.)smartrecruiters\.com$/i;

export function detect(u: URL): Detection | null {
  if (!HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // careers.smartrecruiters.com/<Company>  or  jobs.smartrecruiters.com/<Company>
  const company = parts[0];
  if (!company) return null;
  return {
    atsType: "smartrecruiters",
    identifier: company,
    suggestedName: prettify(company),
    confidence: "high",
  };
}

interface SrPosting {
  id: string;
  name: string;
  ref?: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string };
  department?: { label?: string };
  company?: { identifier?: string; name?: string };
}

interface SrResponse {
  totalFound: number;
  content: SrPosting[];
}

export async function fetchJobs(identifier: string): Promise<FetchResult> {
  const jobs: NormalizedJob[] = [];
  let companyName = prettify(identifier);
  const limit = 100;
  let offset = 0;

  // Paginate through all postings.
  for (let guard = 0; guard < 50; guard++) {
    const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
      identifier
    )}/postings?limit=${limit}&offset=${offset}`;
    const data = await fetchJson<SrResponse>(url);
    for (const p of data.content ?? []) {
      if (p.company?.name) companyName = p.company.name;
      const location = formatLocation(p.location);
      jobs.push({
        externalId: p.id,
        title: p.name,
        url: `https://jobs.smartrecruiters.com/${encodeURIComponent(
          identifier
        )}/${p.id}`,
        locations: location ? [location] : [],
        department: p.department?.label ?? null,
        postedAt: p.releasedDate ?? null,
      });
    }
    offset += limit;
    if (!data.content || data.content.length < limit || offset >= data.totalFound) {
      break;
    }
  }

  return { jobs, companyName };
}

function formatLocation(loc?: SrPosting["location"]): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

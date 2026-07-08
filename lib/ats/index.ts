import type { AtsType, Detection, FetchResult } from "../types";
import { fetchText } from "./http";
import * as greenhouse from "./greenhouse";
import * as lever from "./lever";
import * as ashby from "./ashby";
import * as smartrecruiters from "./smartrecruiters";
import * as workday from "./workday";
import * as generic from "./generic";

const URL_DETECTORS = [
  greenhouse.detect,
  lever.detect,
  ashby.detect,
  smartrecruiters.detect,
  workday.detect,
];

/**
 * Resolve a career page URL to a concrete ATS adapter.
 *  1. Match the URL against known ATS host patterns.
 *  2. If no match, fetch the page and sniff for embedded ATS board links.
 *  3. Fall back to the generic scraper.
 */
export async function detectAts(rawUrl: string): Promise<Detection> {
  const u = new URL(normalizeUrl(rawUrl));

  for (const detect of URL_DETECTORS) {
    const hit = detect(u);
    if (hit) return hit;
  }

  const sniffed = await sniffEmbeddedAts(u.toString());
  if (sniffed) return sniffed;

  return generic.detect(u);
}

/** Fetch the page and look for links/scripts pointing at a known ATS. */
async function sniffEmbeddedAts(pageUrl: string): Promise<Detection | null> {
  let html: string;
  try {
    html = await fetchText(pageUrl);
  } catch {
    return null;
  }

  const patterns: RegExp[] = [
    /https?:\/\/[a-z0-9.-]*greenhouse\.io\/[a-z0-9._-]+/gi,
    /https?:\/\/jobs\.lever\.co\/[a-z0-9._-]+/gi,
    /https?:\/\/jobs\.ashbyhq\.com\/[a-z0-9._-]+/gi,
    /https?:\/\/[a-z0-9.-]*smartrecruiters\.com\/[a-z0-9._-]+/gi,
    /https?:\/\/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[a-zA-Z0-9/._-]+/gi,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[0]) {
      try {
        const embeddedUrl = new URL(match[0]);
        for (const detect of URL_DETECTORS) {
          const hit = detect(embeddedUrl);
          if (hit) return hit;
        }
      } catch {
        // ignore malformed matches
      }
    }
  }
  return null;
}

/** Fetch jobs for an already-detected source. */
export async function fetchJobsFor(
  atsType: AtsType,
  identifier: string
): Promise<FetchResult> {
  switch (atsType) {
    case "greenhouse":
      return greenhouse.fetchJobs(identifier);
    case "lever":
      return lever.fetchJobs(identifier);
    case "ashby":
      return ashby.fetchJobs(identifier);
    case "smartrecruiters":
      return smartrecruiters.fetchJobs(identifier);
    case "workday":
      return workday.fetchJobs(identifier);
    case "generic":
      return generic.fetchJobs(identifier);
    default:
      throw new Error(`Unknown ATS type: ${atsType}`);
  }
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const ATS_LABELS: Record<AtsType, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
  generic: "Generic (best-effort)",
};

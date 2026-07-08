import * as cheerio from "cheerio";
import type { Detection, FetchResult, NormalizedJob } from "../types";
import { fetchText } from "./http";

/**
 * Best-effort scraper for career pages that are not on a supported ATS.
 * Strategy, in order of confidence:
 *   1. Parse JSON-LD JobPosting structured data (most reliable when present).
 *   2. Heuristic extraction of anchor links that look like job postings.
 * Results are inherently lower-confidence than the dedicated ATS adapters.
 */
export async function fetchJobs(pageUrl: string): Promise<FetchResult> {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);

  const companyName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $("title").first().text().trim().split(/[|\-–—]/)[0].trim() ||
    new URL(pageUrl).hostname;

  const fromJsonLd = extractJsonLd($, pageUrl);
  if (fromJsonLd.length > 0) {
    return { jobs: dedupe(fromJsonLd), companyName };
  }

  const fromLinks = extractJobLinks($, pageUrl);
  return { jobs: dedupe(fromLinks), companyName };
}

export function detect(u: URL): Detection {
  return {
    atsType: "generic",
    identifier: u.toString(),
    suggestedName: u.hostname.replace(/^www\./, ""),
    confidence: "low",
  };
}

function extractJsonLd(
  $: cheerio.CheerioAPI,
  pageUrl: string
): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of flattenJsonLd(parsed)) {
      if (getType(node).includes("JobPosting")) {
        const job = jobFromJsonLd(node, pageUrl);
        if (job) jobs.push(job);
      }
    }
  });
  return jobs;
}

function flattenJsonLd(node: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) {
      n.forEach(visit);
    } else if (n && typeof n === "object") {
      const obj = n as Record<string, unknown>;
      out.push(obj);
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
      if (obj.itemListElement) visit(obj.itemListElement);
      if (obj.item) visit(obj.item);
    }
  };
  visit(node);
  return out;
}

function getType(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string") return [t];
  return [];
}

function jobFromJsonLd(
  node: Record<string, unknown>,
  pageUrl: string
): NormalizedJob | null {
  const title = typeof node.title === "string" ? node.title : null;
  if (!title) return null;
  const url =
    (typeof node.url === "string" && node.url) ||
    (typeof node.sameAs === "string" && node.sameAs) ||
    pageUrl;
  const location = extractLocation(node);
  const postedAt =
    typeof node.datePosted === "string" ? node.datePosted : null;
  return {
    externalId: url || title,
    title: title.trim(),
    url: absolutize(url, pageUrl),
    location,
    department: null,
    postedAt,
  };
}

function extractLocation(node: Record<string, unknown>): string | null {
  const jobLoc = node.jobLocation;
  const first = Array.isArray(jobLoc) ? jobLoc[0] : jobLoc;
  if (first && typeof first === "object") {
    const addr = (first as Record<string, unknown>).address;
    if (addr && typeof addr === "object") {
      const a = addr as Record<string, unknown>;
      const parts = [a.addressLocality, a.addressRegion, a.addressCountry]
        .filter((v) => typeof v === "string")
        .map(String);
      if (parts.length) return parts.join(", ");
    }
  }
  if (
    node.jobLocationType === "TELECOMMUTE" ||
    node.applicantLocationRequirements
  ) {
    return "Remote";
  }
  return null;
}

const JOB_LINK_RE = /(job|career|position|opening|vacan|posting|apply|req)/i;

function extractJobLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string
): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 4 || text.length > 140) return;
    if (!JOB_LINK_RE.test(href) && !JOB_LINK_RE.test(text)) return;
    // Skip obvious navigation / social links.
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    const url = absolutize(href, pageUrl);
    jobs.push({
      externalId: url,
      title: text,
      url,
      location: null,
      department: null,
      postedAt: null,
    });
  });
  return jobs;
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function dedupe(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const out: NormalizedJob[] = [];
  for (const j of jobs) {
    const key = j.externalId || j.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

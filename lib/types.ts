export type AtsType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "workday"
  | "generic";

export type SourceStatus = "ok" | "error" | "pending";

export interface Source {
  id: number;
  name: string;
  url: string;
  ats_type: AtsType;
  ats_identifier: string;
  status: SourceStatus;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface Job {
  id: number;
  source_id: number;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  url: string;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: number;
}

/** A job as produced by an ATS adapter, before it is persisted. */
export interface NormalizedJob {
  externalId: string;
  title: string;
  /** Single location string (used by single-location sources). */
  location?: string | null;
  /** All locations for the role; preferred over `location` when present. */
  locations?: string[];
  department?: string | null;
  url: string;
  postedAt?: string | null;
}

/** Result of resolving a career page URL to a concrete ATS adapter. */
export interface Detection {
  atsType: AtsType;
  identifier: string;
  /** Suggested display name for the source, if the adapter can infer one. */
  suggestedName?: string;
  /** Lower for best-effort/generic detection. */
  confidence: "high" | "low";
}

export interface FetchResult {
  jobs: NormalizedJob[];
  /** Optional human-friendly company name discovered while fetching. */
  companyName?: string;
}

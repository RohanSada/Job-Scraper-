"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AtsType } from "@/lib/types";
import { ATS_BADGE_CLASSES, ATS_LABELS, formatDate, timeAgo } from "@/lib/labels";

interface JobRow {
  id: number;
  source_id: number;
  title: string;
  company: string;
  location: string | null;
  department: string | null;
  url: string;
  posted_at: string | null;
  first_seen_at: string;
  ats_type: AtsType;
  source_name: string;
}

interface SourceRow {
  id: number;
  name: string;
  ats_type: AtsType;
  status: string;
}

interface JobsResponse {
  jobs: JobRow[];
  sources: SourceRow[];
  lastRefreshedAt: string | null;
  count: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [postedFrom, setPostedFrom] = useState("");
  const [newOnly, setNewOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (location.trim()) params.set("location", location.trim());
      if (selectedSources.length) params.set("sourceIds", selectedSources.join(","));
      if (postedFrom) params.set("postedFrom", postedFrom);
      if (newOnly && data?.lastRefreshedAt) params.set("newSince", data.lastRefreshedAt);
      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`);
      const json = (await res.json()) as JobsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, location, selectedSources, postedFrom, newOnly]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const refreshAll = async () => {
    setRefreshing(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Refresh failed");
      const s = json.summary;
      setNotice(
        `Refreshed ${s.ok}/${s.sources} sources · ${s.inserted} new, ${s.updated} updated` +
          (s.failed ? ` · ${s.failed} failed` : "")
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSource = (id: number) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setLocation("");
    setSelectedSources([]);
    setPostedFrom("");
    setNewOnly(false);
  };

  const hasSources = (data?.sources.length ?? 0) > 0;
  const lastRefreshedAt = data?.lastRefreshedAt ?? null;

  const filtersActive = useMemo(
    () =>
      Boolean(search || location || selectedSources.length || postedFrom || newOnly),
    [search, location, selectedSources, postedFrom, newOnly]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Latest job postings</h1>
          <p className="text-sm text-slate-400 mt-1">
            {lastRefreshedAt
              ? `Last refreshed ${timeAgo(lastRefreshedAt)}`
              : "Not refreshed yet"}
            {data ? ` · ${data.count} roles shown` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sources"
            className="px-3 py-2 text-sm rounded-md border border-border hover:bg-border/50 transition-colors"
          >
            Manage sources
          </Link>
          <button
            onClick={refreshAll}
            disabled={refreshing || !hasSources}
            className="px-4 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {refreshing ? "Refreshing…" : "Refresh all"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-indigo-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {!hasSources && !loading ? (
        <EmptyState />
      ) : (
        <>
          <FilterBar
            search={search}
            setSearch={setSearch}
            location={location}
            setLocation={setLocation}
            postedFrom={postedFrom}
            setPostedFrom={setPostedFrom}
            newOnly={newOnly}
            setNewOnly={setNewOnly}
            sources={data?.sources ?? []}
            selectedSources={selectedSources}
            toggleSource={toggleSource}
            filtersActive={filtersActive}
            clearFilters={clearFilters}
          />
          <JobTable
            jobs={data?.jobs ?? []}
            loading={loading}
            lastRefreshedAt={lastRefreshedAt}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <h2 className="text-lg font-medium">No career pages saved yet</h2>
      <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
        Add a company career page URL and Job Scraper will detect its ATS
        (Greenhouse, Lever, Ashby, SmartRecruiters, Workday) and pull the latest
        roles for you.
      </p>
      <Link
        href="/sources"
        className="inline-block mt-4 px-4 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 font-medium"
      >
        Add your first source
      </Link>
    </div>
  );
}

interface FilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  postedFrom: string;
  setPostedFrom: (v: string) => void;
  newOnly: boolean;
  setNewOnly: (v: boolean) => void;
  sources: SourceRow[];
  selectedSources: number[];
  toggleSource: (id: number) => void;
  filtersActive: boolean;
  clearFilters: () => void;
}

function FilterBar(props: FilterBarProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Search title / company
          </label>
          <input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="e.g. software engineer"
            className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Location</label>
          <input
            value={props.location}
            onChange={(e) => props.setLocation(e.target.value)}
            placeholder="e.g. remote, London"
            className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Posted on or after
          </label>
          <input
            type="date"
            value={props.postedFrom}
            onChange={(e) => props.setPostedFrom(e.target.value)}
            className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={props.newOnly}
              onChange={(e) => props.setNewOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface accent-accent"
            />
            New this refresh
          </label>
          {props.filtersActive && (
            <button
              onClick={props.clearFilters}
              className="ml-auto text-xs text-slate-400 hover:text-white underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {props.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {props.sources.map((s) => {
            const active = props.selectedSources.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => props.toggleSource(s.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-accent/20 border-accent text-white"
                    : "border-border text-slate-300 hover:bg-border/50"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Locations are stored as a "; "-joined list. Show the first couple with a
// "+N more" suffix, and keep the full list available as a hover tooltip.
function formatLocations(
  raw: string,
  max = 2
): { short: string; full: string } {
  const parts = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const full = parts.join(", ");
  if (parts.length <= max) {
    return { short: full || raw, full: full || raw };
  }
  const shown = parts.slice(0, max).join(", ");
  return { short: `${shown} +${parts.length - max} more`, full };
}

function JobTable({
  jobs,
  loading,
  lastRefreshedAt,
}: {
  jobs: JobRow[];
  loading: boolean;
  lastRefreshedAt: string | null;
}) {
  if (loading && jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-10 text-center text-slate-400 text-sm">
        Loading roles…
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-10 text-center text-slate-400 text-sm">
        No roles match your filters.
      </div>
    );
  }

  const isNew = (j: JobRow) =>
    lastRefreshedAt != null && j.first_seen_at >= lastRefreshedAt;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-card text-left text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Company</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Location</th>
            <th className="px-4 py-3 font-medium">Posted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.map((j) => (
            <tr key={j.id} className="hover:bg-card/60 transition-colors">
              <td className="px-4 py-3">
                <a
                  href={j.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-slate-100 hover:text-accent transition-colors"
                >
                  {j.title}
                </a>
                {isNew(j) && (
                  <span className="ml-2 align-middle text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    New
                  </span>
                )}
                <div className="mt-1 flex items-center gap-2 md:hidden text-xs text-slate-400">
                  <span>{j.company}</span>
                  {j.location && (
                    <span title={formatLocations(j.location).full}>
                      · {formatLocations(j.location).short}
                    </span>
                  )}
                </div>
                {j.department && (
                  <div className="text-xs text-slate-500 mt-0.5">{j.department}</div>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <span>{j.company}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${ATS_BADGE_CLASSES[j.ats_type]}`}
                  >
                    {ATS_LABELS[j.ats_type]}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell text-slate-300">
                {j.location ? (
                  <span title={formatLocations(j.location).full}>
                    {formatLocations(j.location).short}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                {j.posted_at ? formatDate(j.posted_at) : timeAgo(j.first_seen_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

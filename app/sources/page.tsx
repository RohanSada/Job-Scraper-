"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AtsType } from "@/lib/types";
import { ATS_BADGE_CLASSES, ATS_LABELS, timeAgo } from "@/lib/labels";

interface SourceRow {
  id: number;
  name: string;
  url: string;
  ats_type: AtsType;
  ats_identifier: string;
  status: "ok" | "error" | "pending";
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources");
      const json = await res.json();
      setSources(json.sources ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add source");
      const label = ATS_LABELS[json.detection.atsType as AtsType];
      const found = json.refresh?.total ?? 0;
      const lowConf =
        json.detection.confidence === "low"
          ? " (best-effort scraper — results may be incomplete)"
          : "";
      setNotice(`Added via ${label}: found ${found} roles${lowConf}`);
      setUrl("");
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const refreshSource = async (id: number) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Refresh failed");
      const r = json.result;
      if (r.status === "error") {
        setError(`${r.name}: ${r.error}`);
      } else {
        setNotice(`${r.name}: ${r.inserted} new, ${r.updated} updated (${r.total} total)`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const removeSource = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}" and all its saved jobs?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Delete failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Career page sources</h1>
          <p className="text-sm text-slate-400 mt-1">
            Saved once, reused on every refresh.
          </p>
        </div>
        <Link
          href="/"
          className="px-3 py-2 text-sm rounded-md border border-border hover:bg-border/50 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>

      <form
        onSubmit={addSource}
        className="rounded-xl border border-border bg-card/60 p-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Career page URL
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/acme"
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Display name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-detected"
              className="w-full rounded-md bg-surface border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={adding || !url.trim()}
              className="w-full sm:w-auto px-4 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {adding ? "Analyzing…" : "Add source"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Supports Greenhouse, Lever, Ashby, SmartRecruiters and Workday
          automatically. Other sites use a best-effort scraper.
        </p>
      </form>

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

      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No sources yet. Add a career page above to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Platform</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-card/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-accent break-all"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${ATS_BADGE_CLASSES[s.ats_type]}`}
                    >
                      {ATS_LABELS[s.ats_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell source={s} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => refreshSource(s.id)}
                        disabled={busyId === s.id}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-border/50 disabled:opacity-40 transition-colors"
                      >
                        {busyId === s.id ? "…" : "Refresh"}
                      </button>
                      <button
                        onClick={() => removeSource(s.id, s.name)}
                        disabled={busyId === s.id}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusCell({ source }: { source: SourceRow }) {
  if (source.status === "error") {
    return (
      <div>
        <span className="inline-flex items-center gap-1.5 text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-400" /> Error
        </span>
        {source.last_error && (
          <div
            className="text-xs text-red-300/70 mt-1 max-w-xs truncate"
            title={source.last_error}
          >
            {source.last_error}
          </div>
        )}
      </div>
    );
  }
  if (source.status === "ok") {
    return (
      <div>
        <span className="inline-flex items-center gap-1.5 text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> OK
        </span>
        <div className="text-xs text-slate-500 mt-1">
          {timeAgo(source.last_fetched_at)}
        </div>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-400">
      <span className="h-2 w-2 rounded-full bg-slate-500" /> Pending
    </span>
  );
}

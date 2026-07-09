import { NextResponse } from "next/server";
import { lastRefreshedAt, lastRefreshStartedAt } from "@/lib/db";
import { refreshAll } from "@/lib/refresh";

export const dynamic = "force-dynamic";
// Refreshing can take a while when there are many sources.
export const maxDuration = 300;

export async function POST() {
  const results = await refreshAll();
  const summary = {
    sources: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status === "error").length,
    inserted: results.reduce((n, r) => n + r.inserted, 0),
    updated: results.reduce((n, r) => n + r.updated, 0),
  };
  return NextResponse.json({
    summary,
    results,
    lastRefreshedAt: lastRefreshedAt(),
    refreshStartedAt: lastRefreshStartedAt(),
  });
}

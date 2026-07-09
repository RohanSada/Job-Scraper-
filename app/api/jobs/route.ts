import { NextResponse } from "next/server";
import {
  lastRefreshedAt,
  lastRefreshStartedAt,
  listSources,
  queryJobs,
  type JobFilters,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const filters: JobFilters = {
    search: searchParams.get("search") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    postedFrom: searchParams.get("postedFrom") ?? undefined,
    postedTo: searchParams.get("postedTo") ?? undefined,
    newSince: searchParams.get("newSince") ?? undefined,
  };

  const sourceIdsParam = searchParams.get("sourceIds");
  if (sourceIdsParam) {
    filters.sourceIds = sourceIdsParam
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n));
  }

  const jobs = queryJobs(filters);

  return NextResponse.json({
    jobs,
    sources: listSources(),
    lastRefreshedAt: lastRefreshedAt(),
    refreshStartedAt: lastRefreshStartedAt(),
    count: jobs.length,
  });
}

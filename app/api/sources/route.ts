import { NextResponse } from "next/server";
import { detectAts, normalizeUrl, ATS_LABELS } from "@/lib/ats";
import { findSourceByUrl, insertSource, listSources } from "@/lib/db";
import { refreshOne } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sources: listSources() });
}

export async function POST(req: Request) {
  let body: { url?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "A career page URL is required" }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeUrl(rawUrl);
    // Validate it parses.
    new URL(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  if (findSourceByUrl(url)) {
    return NextResponse.json(
      { error: "That URL is already saved" },
      { status: 409 }
    );
  }

  let detection;
  try {
    detection = await detectAts(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not analyze that page: ${message}` },
      { status: 422 }
    );
  }

  const name =
    body.name?.trim() ||
    detection.suggestedName ||
    new URL(url).hostname.replace(/^www\./, "");

  const source = insertSource({
    name,
    url,
    ats_type: detection.atsType,
    ats_identifier: detection.identifier,
  });

  // Do an initial fetch so the dashboard is populated immediately.
  const refresh = await refreshOne(source.id);

  return NextResponse.json(
    {
      source,
      detection: {
        atsType: detection.atsType,
        atsLabel: ATS_LABELS[detection.atsType],
        confidence: detection.confidence,
      },
      refresh,
    },
    { status: 201 }
  );
}

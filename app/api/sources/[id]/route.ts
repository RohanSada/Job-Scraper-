import { NextResponse } from "next/server";
import { deleteSource, getSource } from "@/lib/db";
import { refreshOne } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
  }
  if (!getSource(id)) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  deleteSource(id);
  return NextResponse.json({ ok: true });
}

// Refresh a single source.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid source id" }, { status: 400 });
  }
  const result = await refreshOne(id);
  if (!result) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  return NextResponse.json({ result });
}

import type { AtsType } from "./types";

// Client-safe labels (no server-only imports).
export const ATS_LABELS: Record<AtsType, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
  generic: "Generic",
};

export const ATS_BADGE_CLASSES: Record<AtsType, string> = {
  greenhouse: "bg-green-500/15 text-green-300 border-green-500/30",
  lever: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  ashby: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  smartrecruiters: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  workday: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  generic: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const ms = Date.now() - then.getTime();
  if (Number.isNaN(ms)) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

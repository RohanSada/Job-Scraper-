# Job Scraper

A local-first web app that aggregates job postings from company career pages into one searchable dashboard. Save your career page URLs once, refresh on demand, and filter across all sources without opening dozens of sites every day.

Built with **Next.js**, **TypeScript**, and **SQLite**. No external services or accounts required.

## Why this exists

Most companies publish roles on a handful of Applicant Tracking Systems (ATS): Greenhouse, Lever, Ashby, SmartRecruiters, Workday, and others. Each has a public API or predictable URL structure. Job Scraper detects which platform a career page uses, pulls open roles automatically, and stores them locally so you can search and filter in one place.

## Features

- **Saved sources** — Add career page URLs once; they persist in a local SQLite database
- **Automatic ATS detection** — Greenhouse, Lever, Ashby, SmartRecruiters, and Workday via public APIs
- **Embedded board sniffing** — If a custom careers page embeds a known ATS board, the app detects and uses the right adapter
- **Generic fallback** — Best-effort scraper for unsupported sites (JSON-LD `JobPosting` + heuristic link extraction)
- **Multi-location support** — Real locations are stored and searchable (not summary text like "2 Locations")
- **Manual refresh** — One-click "Refresh all" or per-source refresh
- **Filtering** — Search by title/company, location, posted date, source, and "new this refresh"
- **New job badges** — Highlights roles first seen in the latest refresh
- **Fully local** — Data lives in `data/jobs.db` on your machine

## Supported platforms

| Platform | Example URL |
| --- | --- |
| Greenhouse | `https://boards.greenhouse.io/<company>` |
| Lever | `https://jobs.lever.co/<company>` |
| Ashby | `https://jobs.ashbyhq.com/<company>` |
| SmartRecruiters | `https://careers.smartrecruiters.com/<Company>` |
| Workday | `https://<tenant>.wd<N>.myworkdayjobs.com/<site>` |
| Other | Any career/jobs page URL (generic fallback) |

Workday examples:

- `https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite`
- `https://labcorp.wd1.myworkdayjobs.com/External/job/`

## Getting started

### Prerequisites

- **Node.js** 18.17+ (20+ recommended)
- **npm**

### Install and run

```bash
git clone <your-repo-url>
cd job-scraper

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** `better-sqlite3` is a native module. If install fails to build it, run:
>
> ```bash
> npm rebuild better-sqlite3
> ```

### Production build

```bash
npm run build
npm start
```

### Add career pages

1. Open the **Sources** page
2. Paste a career page URL (e.g. `https://boards.greenhouse.io/robinhood`)
3. Click **Add source** — the app detects the ATS and fetches current roles
4. Go to the **Dashboard** to browse and filter

### Optional: seed sample sources

With the dev server running, in another terminal:

```bash
npm run seed
```

This adds a few example sources (Greenhouse, Ashby, SmartRecruiters, Workday) so the dashboard is populated immediately.

## Usage

### Dashboard

- View all jobs across saved sources in one table
- **Refresh all** — Re-fetch every source and update the database
- **Filters:**
  - Free-text search (title, company, department)
  - Location (substring match against any location on the role)
  - Posted on or after (date)
  - Filter by source (company)
  - "New this refresh" toggle

### Sources

- Add, refresh, or remove career page URLs
- See detected ATS platform, last refresh time, and per-source errors

## How it works

```
Career URL
    │
    ▼
ATS detection (URL pattern → page sniff → generic fallback)
    │
    ▼
Adapter fetches jobs via public API (or HTML scraper)
    │
    ▼
Normalize & upsert into SQLite (dedupe by source + external id)
    │
    ▼
Dashboard (search, filter, "New" badges)
```

**Multi-location roles:** For platforms that summarize locations (e.g. Workday's "2 Locations"), the app resolves the real location list during refresh so filtering by terms like `US`, `Remote`, or `London` works correctly.

**Refresh behavior:** Jobs are upserted by `(source_id, external_id)`. Re-refreshing updates existing roles, tracks `first_seen_at` for new badges, and marks roles no longer listed as inactive.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React, Tailwind CSS |
| Database | SQLite via `better-sqlite3` |
| HTML parsing | Cheerio (generic fallback) |

## Project structure

```
app/
  api/
    jobs/          # GET — query jobs with filters
    refresh/       # POST — refresh all sources
    sources/       # GET/POST — list/add sources
    sources/[id]/  # DELETE/POST — remove or refresh one source
  page.tsx         # Dashboard
  sources/         # Source manager UI
lib/
  ats/             # ATS adapters, detection, generic scraper
  db.ts            # SQLite schema, upsert, queries
  refresh.ts       # Fetch + upsert orchestration
scripts/
  seed.mjs         # Optional sample sources
data/
  jobs.db          # Local database (created on first run, git-ignored)
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run seed` | Add sample sources (requires dev server) |
| `npm run lint` | Run ESLint |

## Limitations

- **Generic fallback is best-effort.** JavaScript-heavy career sites that render listings client-side may return partial or no results.
- **Posted dates** depend on what each ATS exposes. When unavailable, the app uses the date the role was first seen.
- **Workday posted dates** are often relative ("Posted 5 Days Ago") and converted to approximate timestamps.
- **Workday refresh** can be slower for boards with many multi-location roles (one extra API call per such job).
- **Greenhouse refresh** uses `content=true` for office/location data, which increases payload size.
- **Public ATS endpoints** may rate-limit or change; failures appear per-source on the Sources page.

## Troubleshooting

**Port already in use**

Next.js will try the next port (e.g. 3001). Stop other dev servers or set a port explicitly:

```bash
PORT=3000 npm run dev
```

**Source refresh fails**

Check the error on the Sources page. Common causes: invalid URL, ATS API changes, or temporary rate limiting. Try refreshing that source again later.

**Location filter not matching**

Click **Refresh all** so jobs are re-fetched with resolved multi-location data. The filter uses substring matching (e.g. `US` matches `US, CA, Santa Clara` but not `New York, NY`).

## License

Add your preferred license here (e.g. MIT).

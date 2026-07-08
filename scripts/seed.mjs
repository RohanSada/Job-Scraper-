#!/usr/bin/env node
/**
 * Seed a handful of example career pages into a running Job Scraper instance.
 * Usage: start the app (`npm run dev`) in one terminal, then run `npm run seed`.
 * Optionally set BASE_URL if the app is not on http://localhost:3000.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const SAMPLE_SOURCES = [
  "https://boards.greenhouse.io/robinhood",
  "https://jobs.ashbyhq.com/ashby",
  "https://careers.smartrecruiters.com/Visa",
  "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
];

async function main() {
  console.log(`Seeding ${SAMPLE_SOURCES.length} sources into ${BASE_URL} ...\n`);
  for (const url of SAMPLE_SOURCES) {
    try {
      const res = await fetch(`${BASE_URL}/api/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.log(`  ✗ ${url} -> ${json.error ?? res.status}`);
        continue;
      }
      const found = json.refresh?.total ?? 0;
      console.log(`  ✓ ${url} -> ${json.detection.atsLabel}: ${found} roles`);
    } catch (err) {
      console.log(`  ✗ ${url} -> ${err.message} (is the app running?)`);
    }
  }
  console.log("\nDone. Open the dashboard to see the roles.");
}

main();

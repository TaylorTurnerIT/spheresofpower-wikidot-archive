#!/usr/bin/env node
/**
 * check-coverage.mjs
 *
 * Fetches the live sitemap from spheresofpower.wikidot.com, compares it
 * against the pages/ directory, and reports what is missing, extra, or stale.
 *
 * Usage:
 *   node check-coverage.mjs [--missing] [--extra] [--stale] [--summary] [--no-fetch]
 *
 *   --missing   Show pages in sitemap not present locally         (default: shown)
 *   --extra     Show local files not in sitemap (deleted/renamed)
 *   --stale     Show local pages where sitemap lastmod > last git commit for that file
 *   --summary   Print counts only, suppress per-file lines
 *   --no-fetch  Skip network fetch; use cached sitemap.xml if present
 *
 * Stale detection uses git author dates (set by rmaint.py to the Wikidot revision
 * timestamp), NOT file mtimes — so it is accurate even after a git clone.
 */

import { existsSync, readdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, "pages");
const SITEMAP_CACHE = join(__dirname, "sitemap.xml");
const SITEMAP_URL = "https://spheresofpower.wikidot.com/sitemap.xml";
const SITE_BASE = "http://spheresofpower.wikidot.com/";

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const explicitMode = args.has("--extra") || args.has("--stale");
const showMissing = !explicitMode || args.has("--missing");
const showExtra   = args.has("--extra");
const showStale   = args.has("--stale");
const summaryOnly = args.has("--summary");
const noFetch     = args.has("--no-fetch");

// ─── Fetch or read sitemap ────────────────────────────────────────────────────

let xml;

if (noFetch && existsSync(SITEMAP_CACHE)) {
  process.stderr.write("Using cached sitemap.xml\n");
  xml = readFileSync(SITEMAP_CACHE, "utf-8");
} else {
  process.stderr.write(`Fetching ${SITEMAP_URL} ...\n`);
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    process.stderr.write(`Error: HTTP ${res.status} fetching sitemap\n`);
    process.exit(1);
  }
  xml = await res.text();
  writeFileSync(SITEMAP_CACHE, xml, "utf-8");
  process.stderr.write("Cached to sitemap.xml\n");
}

// ─── Parse sitemap ────────────────────────────────────────────────────────────

function parseSitemap(xml) {
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  const entries = [];

  for (const block of urlBlocks) {
    const locMatch     = block.match(/<loc>(.*?)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
    if (!locMatch) continue;

    const loc = locMatch[1].trim();
    if (!loc.startsWith(SITE_BASE)) continue;

    const slug = loc.slice(SITE_BASE.length).replace(/\/$/, "");
    if (!slug) continue;

    const lastmod = lastmodMatch ? new Date(lastmodMatch[1].trim()) : null;
    entries.push({ slug, lastmod });
  }

  return entries;
}

const sitemapEntries = parseSitemap(xml);
const sitemapMap = new Map(sitemapEntries.map((e) => [e.slug, e.lastmod]));

// ─── Read local pages ─────────────────────────────────────────────────────────

if (!existsSync(PAGES_DIR)) {
  process.stderr.write(`Error: pages/ directory not found at ${PAGES_DIR}\n`);
  process.exit(1);
}

const localFiles = readdirSync(PAGES_DIR)
  .filter((f) => f.endsWith(".txt"))
  .map((f) => f.slice(0, -4));

const localSet = new Set(localFiles);

// ─── Build git timestamp map (slug → last commit unix timestamp) ──────────────
// Walk git log once in reverse-chronological order. The first time we encounter
// a file we record its timestamp — that is the most-recent crawled revision.
// rmaint.py sets GIT_AUTHOR_DATE to the Wikidot revision timestamp, so this
// accurately reflects "when was the last version of this page that we crawled".

function buildGitTimestampMap() {
  const map = new Map(); // slug → unix seconds (number)

  if (showStale) {
    process.stderr.write("Reading git history for last-crawl timestamps...\n");
  }

  const result = spawnSync(
    "git",
    ["log", "--format=COMMIT %at", "--name-only", "--diff-filter=AM"],
    { cwd: __dirname, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    process.stderr.write("Warning: git log failed — stale check unavailable\n");
    return map;
  }

  let currentTs = null;
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("COMMIT ")) {
      currentTs = parseInt(line.slice(7), 10);
    } else if (line.startsWith("pages/") && line.endsWith(".txt")) {
      const slug = line.slice(6, -4); // strip "pages/" prefix and ".txt" suffix
      if (!map.has(slug)) {
        map.set(slug, currentTs); // first occurrence = most recent commit
      }
    }
  }

  return map;
}

const gitTs = (showStale || !summaryOnly) ? buildGitTimestampMap() : new Map();

// ─── Compare ──────────────────────────────────────────────────────────────────

// Pages in sitemap but not locally
const missing = sitemapEntries
  .filter((e) => !localSet.has(e.slug))
  .sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return a.slug.localeCompare(b.slug);
    if (!a.lastmod) return 1;
    if (!b.lastmod) return -1;
    return b.lastmod - a.lastmod; // newest first
  });

// Local files not in sitemap
const extra = localFiles
  .filter((slug) => !sitemapMap.has(slug))
  .sort();

// Local files whose sitemap lastmod is newer than the last git commit for that file
const stale = localFiles
  .filter((slug) => {
    const lastmod = sitemapMap.get(slug);
    if (!lastmod) return false;
    const commitTs = gitTs.get(slug);
    if (commitTs === undefined) return false;
    return lastmod.getTime() > commitTs * 1000;
  })
  .map((slug) => {
    const lastmod = sitemapMap.get(slug);
    const commitTs = gitTs.get(slug);
    const commitDate = new Date(commitTs * 1000);
    const ageDays = Math.round((lastmod.getTime() - commitDate.getTime()) / 86_400_000);
    return { slug, lastmod, commitDate, ageDays };
  })
  .sort((a, b) => b.ageDays - a.ageDays);

// ─── Output ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => (d ? d.toISOString().slice(0, 10) : "no-date");
const pad = (s, n) => String(s).padEnd(n);

if (!summaryOnly) {
  if (showMissing && missing.length > 0) {
    console.log(`\n=== MISSING (${missing.length} pages in sitemap, not local) ===`);
    console.log(pad("slug", 52) + "lastmod");
    for (const { slug, lastmod } of missing) {
      console.log(pad(slug, 52) + fmtDate(lastmod));
    }
  }

  if (showExtra && extra.length > 0) {
    console.log(`\n=== EXTRA (${extra.length} local files not in sitemap) ===`);
    for (const slug of extra) {
      console.log(slug);
    }
  } else if (showExtra) {
    console.log(`\n=== EXTRA ===\n(none — all local files are present in sitemap)`);
  }

  if (showStale && stale.length > 0) {
    console.log(`\n=== STALE (${stale.length} local files older than sitemap lastmod) ===`);
    console.log(pad("slug", 52) + pad("sitemap-lastmod", 17) + pad("last-crawled", 13) + "days-behind");
    for (const { slug, lastmod, commitDate, ageDays } of stale) {
      console.log(
        pad(slug, 52) +
        pad(fmtDate(lastmod), 17) +
        pad(fmtDate(commitDate), 13) +
        ageDays,
      );
    }
  } else if (showStale) {
    console.log(`\n=== STALE ===\n(none — all local files are up to date)`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n=== SUMMARY ===`);
console.log(`Sitemap pages:   ${sitemapMap.size}`);
console.log(`Local pages:     ${localSet.size}`);
console.log(`Missing locally: ${missing.length}`);
console.log(`Extra locally:   ${extra.length}  (not in sitemap — likely deleted/renamed on wiki)`);
console.log(`Stale locally:   ${stale.length}  (wiki updated since last crawl)`);

#!/usr/bin/env node
// Usage: extract_scores.js <lhci-dir> [--compare <other-lhci-dir>]
// Example: extract_scores.js ./lhci/before/mobile
// Example: extract_scores.js ./lhci/after/mobile --compare ./lhci/before/mobile
//
// Reads manifest.json + individual JSON reports to produce a Markdown table
// with Lighthouse scores and Core Web Vitals (median of all runs per URL).

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: extract_scores.js <lhci-dir> [--compare <before-dir>]"
    );
    process.exit(1);
  }
  const result = { dir: args[0], compareDir: null };
  const cmpIdx = args.indexOf("--compare");
  if (cmpIdx !== -1 && args[cmpIdx + 1]) {
    result.compareDir = args[cmpIdx + 1];
  }
  return result;
}

function loadManifest(dir) {
  const p = path.join(dir, "manifest.json");
  if (!fs.existsSync(p)) {
    console.error(`manifest.json not found in ${dir}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function extractMetrics(jsonPath, baseDir) {
  // manifest.json may have absolute paths from the original machine;
  // fall back to resolving the basename relative to baseDir.
  let resolvedPath = jsonPath;
  if (!fs.existsSync(resolvedPath)) {
    resolvedPath = path.join(baseDir, path.basename(jsonPath));
  }
  if (!fs.existsSync(resolvedPath)) return null;

  const data = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  const a = data.audits || {};
  return {
    performance: (data.categories?.performance?.score ?? 0) * 100,
    accessibility: (data.categories?.accessibility?.score ?? 0) * 100,
    "best-practices": (data.categories?.["best-practices"]?.score ?? 0) * 100,
    seo: (data.categories?.seo?.score ?? 0) * 100,
    fcp: a["first-contentful-paint"]?.numericValue ?? null,
    lcp: a["largest-contentful-paint"]?.numericValue ?? null,
    cls: a["cumulative-layout-shift"]?.numericValue ?? null,
    tbt: a["total-blocking-time"]?.numericValue ?? null,
    si: a["speed-index"]?.numericValue ?? null,
  };
}

function aggregateByUrl(manifest, baseDir) {
  const byUrl = {};
  for (const entry of manifest) {
    if (!byUrl[entry.url]) byUrl[entry.url] = [];
    const m = extractMetrics(entry.jsonPath, baseDir);
    if (m) byUrl[entry.url].push(m);
  }

  const result = {};
  for (const [url, runs] of Object.entries(byUrl)) {
    const keys = [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
      "fcp",
      "lcp",
      "cls",
      "tbt",
      "si",
    ];
    const medians = {};
    for (const k of keys) {
      const vals = runs.map((r) => r[k]).filter((v) => v !== null);
      medians[k] = vals.length > 0 ? median(vals) : null;
    }
    result[url] = medians;
  }
  return result;
}

function urlLabel(url) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.hostname + u.pathname;
  } catch {
    return url;
  }
}

function fmt(val, decimals = 0) {
  if (val === null || val === undefined) return "-";
  return Number(val).toFixed(decimals);
}

function fmtMs(val) {
  if (val === null || val === undefined) return "-";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function printTable(data, label) {
  const urls = Object.keys(data);
  if (urls.length === 0) return;

  console.log(`### ${label}\n`);
  console.log(
    "| Page | Performance | Accessibility | Best Practices | SEO | FCP (ms) | LCP (ms) | CLS | TBT (ms) | SI (ms) |"
  );
  console.log(
    "|------|-------------|---------------|----------------|-----|----------|----------|-------|----------|---------|"
  );

  for (const url of urls) {
    const m = data[url];
    console.log(
      `| ${urlLabel(url)} | ${fmt(m.performance)} | ${fmt(m.accessibility)} | ${fmt(m["best-practices"])} | ${fmt(m.seo)} | ${fmtMs(m.fcp)} | ${fmtMs(m.lcp)} | ${fmt(m.cls, 3)} | ${fmtMs(m.tbt)} | ${fmtMs(m.si)} |`
    );
  }
  console.log();
}

function printCompareTable(before, after, label) {
  const urls = Object.keys(after);
  if (urls.length === 0) return;

  console.log(`### ${label} (Before vs After)\n`);
  console.log(
    "| Page | Metric | Before | After | Diff | Change % |"
  );
  console.log(
    "|------|--------|--------|-------|------|----------|"
  );

  // lowerIsBetter: true means a decrease is an improvement (time/shift metrics)
  const metrics = [
    { key: "performance", label: "Performance", dec: 0, lowerIsBetter: false },
    { key: "accessibility", label: "Accessibility", dec: 0, lowerIsBetter: false },
    { key: "best-practices", label: "Best Practices", dec: 0, lowerIsBetter: false },
    { key: "seo", label: "SEO", dec: 0, lowerIsBetter: false },
    { key: "fcp", label: "FCP (ms)", dec: 0, isMs: true, lowerIsBetter: true },
    { key: "lcp", label: "LCP (ms)", dec: 0, isMs: true, lowerIsBetter: true },
    { key: "cls", label: "CLS", dec: 3, lowerIsBetter: true },
    { key: "tbt", label: "TBT (ms)", dec: 0, isMs: true, lowerIsBetter: true },
    { key: "si", label: "SI (ms)", dec: 0, isMs: true, lowerIsBetter: true },
  ];

  for (const url of urls) {
    const b = before[url] || {};
    const a = after[url] || {};
    for (const m of metrics) {
      const bv = b[m.key];
      const av = a[m.key];
      const bStr = m.isMs ? fmtMs(bv) : fmt(bv, m.dec);
      const aStr = m.isMs ? fmtMs(av) : fmt(av, m.dec);
      let diff = "-";
      let pct = "-";
      if (bv != null && av != null) {
        const d = av - bv;
        diff = (d >= 0 ? "+" : "") + (m.isMs ? fmtMs(d) : fmt(d, m.dec));
        if (bv !== 0) {
          const p = ((av - bv) / bv) * 100;
          const improved = m.lowerIsBetter ? d < 0 : d > 0;
          const worsened = m.lowerIsBetter ? d > 0 : d < 0;
          const indicator = improved ? " ^" : worsened ? " v" : "";
          pct = (p >= 0 ? "+" : "") + fmt(p, 1) + "%" + indicator;
        }
      }
      console.log(
        `| ${urlLabel(url)} | ${m.label} | ${bStr} | ${aStr} | ${diff} | ${pct} |`
      );
    }
  }
  console.log();
}

// Main
const { dir, compareDir } = parseArgs();
const manifest = loadManifest(dir);
const data = aggregateByUrl(manifest, dir);

if (compareDir) {
  const beforeManifest = loadManifest(compareDir);
  const beforeData = aggregateByUrl(beforeManifest, compareDir);
  printCompareTable(beforeData, data, path.basename(path.dirname(dir)));
} else {
  printTable(data, path.basename(path.dirname(dir)));
}

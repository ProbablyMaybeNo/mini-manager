#!/usr/bin/env node
/**
 * Lighthouse audit via Google PageSpeed Insights API.
 *
 * Hits the 5 primary routes × 2 form factors (mobile + desktop) and
 * prints a markdown table to stdout that can be pasted directly into
 * docs/PERFORMANCE_AUDIT.md.
 *
 * No local lighthouse install required — PSI runs the audit on
 * Google's infrastructure. Free for low usage (~25k req/day) and does
 * not require an API key for unauthenticated use.
 *
 * Run:
 *   node scripts/audit-lighthouse.mjs
 *   node scripts/audit-lighthouse.mjs --base https://miniaturemanager.vercel.app
 *
 * Optionally pipe to file:
 *   node scripts/audit-lighthouse.mjs > .lighthouse-run.md
 */

const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base");
const BASE = baseFlag >= 0 ? args[baseFlag + 1] : "https://miniaturemanager.vercel.app";

const ROUTES = ["/", "/library", "/projects", "/sign-in", "/tools/eyedropper"];
const STRATEGIES = ["mobile", "desktop"];

const PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const API_KEY = process.env.PSI_API_KEY ?? "";
const REQUEST_DELAY_MS = 6000;       // pause between requests to avoid 429
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;        // 30s backoff before each retry

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(n) {
  if (n == null) return "—";
  return Math.round(n * 100);
}

function ms(n) {
  if (n == null) return "—";
  return `${Math.round(n)}ms`;
}

function fmtCls(n) {
  if (n == null) return "—";
  return n.toFixed(3);
}

async function auditOnce(url, strategy) {
  const target =
    `${PSI}?url=${encodeURIComponent(url)}&strategy=${strategy}` +
    `&category=performance&category=accessibility&category=best-practices` +
    (API_KEY ? `&key=${API_KEY}` : "");
  const res = await fetch(target);
  if (res.status === 429) {
    return { error: "HTTP 429", retryable: true };
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, retryable: false };
  }
  const data = await res.json();
  const lh = data.lighthouseResult;
  if (!lh) return { error: "no lighthouseResult", retryable: false };
  const cats = lh.categories ?? {};
  const audits = lh.audits ?? {};
  return {
    perf: pct(cats.performance?.score),
    a11y: pct(cats.accessibility?.score),
    best: pct(cats["best-practices"]?.score),
    lcp: ms(audits["largest-contentful-paint"]?.numericValue),
    tbt: ms(audits["total-blocking-time"]?.numericValue),
    cls: fmtCls(audits["cumulative-layout-shift"]?.numericValue),
  };
}

async function audit(url, strategy) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      process.stderr.write(`retry ${attempt}/${MAX_RETRIES}... `);
      await sleep(RETRY_DELAY_MS);
    }
    const result = await auditOnce(url, strategy);
    if (!result.error || !result.retryable) return result;
  }
  return { error: "HTTP 429 after retries" };
}

async function main() {
  console.error(`Auditing ${BASE} — ${ROUTES.length} routes × ${STRATEGIES.length} strategies (this takes ~60-90s)\n`);

  const rows = [];
  let firstRequest = true;
  for (const route of ROUTES) {
    for (const strategy of STRATEGIES) {
      if (!firstRequest) await sleep(REQUEST_DELAY_MS);
      firstRequest = false;
      const url = `${BASE}${route}`;
      process.stderr.write(`  · ${strategy.padEnd(8)} ${url} ... `);
      const r = await audit(url, strategy);
      if (r.error) {
        process.stderr.write(`FAILED (${r.error})\n`);
      } else {
        process.stderr.write(`perf ${r.perf}  a11y ${r.a11y}  best ${r.best}\n`);
      }
      rows.push({ route, strategy, ...r });
    }
  }

  console.log("");
  console.log(`# Lighthouse run — ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
  console.log("");
  console.log(`Target: ${BASE}`);
  console.log("");
  console.log("| Route               | Form factor | Perf | A11y | Best | LCP    | TBT    | CLS   |");
  console.log("|---------------------|-------------|-----:|-----:|-----:|-------:|-------:|------:|");
  for (const r of rows) {
    if (r.error) {
      console.log(`| \`${r.route}\` | ${r.strategy} | — | — | — | — | — | — | (error: ${r.error}) |`);
    } else {
      console.log(`| \`${r.route.padEnd(18)}\` | ${r.strategy.padEnd(7)} | ${String(r.perf).padStart(4)} | ${String(r.a11y).padStart(4)} | ${String(r.best).padStart(4)} | ${r.lcp.padStart(6)} | ${r.tbt.padStart(6)} | ${r.cls.padStart(5)} |`);
    }
  }
  console.log("");
  console.log("**Targets:** Perf ≥ 90 mobile / ≥ 95 desktop · LCP < 2.5s · TBT < 200ms · CLS < 0.1");
}

main().catch((err) => {
  console.error("audit failed:", err);
  process.exit(1);
});

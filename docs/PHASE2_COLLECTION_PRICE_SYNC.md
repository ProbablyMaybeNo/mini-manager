# Phase 2 — Collection Price "Autopopulate / Sync" (spec)

**Status:** Proposed (Ross greenlit the *idea* 2026-07-06; build is its own project, gated on this spec).
**Depends on:** Phase 1 (`paintId` link between Library `inventoryEntries` and Collection `wishlistItems`). Price scraping needs the catalog `paintId` to key a shared price on.

---

## Goal

A **"Sync"** button on the Collection paint table: the user selects paints (or "all missing"),
presses Sync, and the app fills in the **price** (and optionally size/vendor) for each — without
the user typing it. Manual prices always win; scraped values are editable estimates.

## The one hard truth

The button is trivial; **"the price of a paint" is not a single number.** It varies by:
- **Retailer** (Amazon vs a hobby store vs the manufacturer)
- **Region / currency** (USD / GBP / EUR)
- **Pot size** (17 ml vs 100 ml)
- **Time** (sales, restocks, discontinuations)

A naive "scrape the price" returns confident-but-wrong numbers for most users. Every design
decision below exists to manage that, not to write the scraper.

## Architecture (the version that actually works)

1. **Shared, cached price table — scrape once *globally*, not per-user-per-click.**
   New table `paint_prices` keyed by catalog `paintId` (+ region/currency):
   ```
   paint_prices(
     paint_id text, region text, currency text,
     price_cents integer, size_ml integer, vendor text, source_url text,
     confidence text,               -- high | medium | low
     checked_at timestamp_ms,       -- staleness
     PRIMARY KEY (paint_id, region)
   )
   ```
   Every user's Sync is a cheap lookup into this table. Thousands of live scrapes collapse into
   one amortized scrape per paint per region, re-run on a schedule.

2. **Background job, never a blocking button.** Press Sync → enqueue → fill in as results land,
   each stamped "checked 3 days ago." No spinner-staring. Maps directly onto Ross's existing
   **webscraper service** (FastAPI :8091) / `scraper-agent` / task-queue infra — reuse, don't rebuild.

3. **Region / currency setting** (per user) so the scrape targets a consistent source instead of
   guessing. Default from locale; overridable.

4. **Prices are editable *estimates*.** Show "~$4.50 · est." with a last-checked stamp; the user's
   manual entry always overrides and is never clobbered by a later sync (respect a
   `price_source: manual | estimate` flag on the Collection row).

## Scrape strategy (in preference order)

1. **Manufacturer MSRP** where published — one price per product line, most stable, least volatile.
2. **A small set of known retailers** per region (curated adapters, like the existing site-specific
   scrapers) — not "search the whole web," which is fragile and ToS-risky.
3. **LLM vision/extraction only as a fallback** on a product page we already located, not as the
   primary "find the price" mechanism.

## Sync flow

```
User selects paints → "Sync prices"
  → resolve each to catalog paintId (Phase 1 link) + user region
  → for each: paint_prices cache hit & fresh?  → fill instantly
                              stale / missing?  → enqueue scrape job
  → background worker scrapes (MSRP → retailer adapter → LLM fallback),
    writes paint_prices, streams results back
  → Collection rows fill with estimate + checked_at; manual prices untouched
```

## Gotchas to design around
- **Staleness** — prices rot; show `checked_at`, re-scrape on a schedule, mark stale > N days.
- **ToS / rate limits** — curated retailer adapters + polite rate limiting, not broad crawling.
- **Cost / latency** — the shared cache is what keeps this cheap; per-user live scraping is the
  anti-pattern to avoid.
- **Ambiguous matches** — a catalog paint may map to several SKUs (sizes); pick a canonical size
  (e.g. the standard pot) and record `size_ml` so the number is interpretable.
- **Non-catalog paints** — Collection rows with no `paintId` (custom entries) can't be synced;
  they stay manual (that's fine).

## Rough effort
- Cache table + region setting + Sync button wired to a stub job: **small.**
- One good scraper adapter (e.g. manufacturer MSRP for the top brands): **medium.**
- Broad multi-retailer/region coverage + freshness scheduling: **ongoing** (this is the real cost).

Ship it in that order — a useful subset (top brands' MSRP, one region) delivers most of the value
before the long tail.

## Open questions for Ross
1. **Which price** do you want as the target — manufacturer MSRP (stable) or a specific retailer's
   street price (what people actually pay)?
2. **Regions at launch** — just USD to start, or USD + GBP + EUR?
3. Is price primarily for the **per-project budgeting** feature (your earlier idea), or just to
   fill the Collection's Total Spent / Remaining? (Changes whether estimates are "good enough.")

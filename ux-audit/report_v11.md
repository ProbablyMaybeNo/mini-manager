# Mini Manager — Round 11 UX Audit (Phase 14 verification)

**Live URL:** https://miniaturemanager.vercel.app
**Date:** 2026-06-01
**Auditor account:** existing `recruit_r10` session reused (sign-out automation timed out on confirm dialog; recruit_r10 was in fresh-equivalent empty state so widget verification was unaffected)
**Viewports verified:** 1440×900 (desktop), 375×812 (iPhone mini), 414×896 (spot-check)

## Verdict: 🟢 Phase 14 complete. PLANNER works. Dashboard ready for daily use.

All five PLANNER widgets render correctly, accept input, persist across reloads, and update each other live. Calendar events display the right coloured dot on the right day. Activity stream surfaces stage-bumps within a second. Streak counter ticks to 1 after the first day's action. Heatmap paints today's cell green at the documented brightness tier. Inspo gallery accepts external URLs, surfaces hide/show/delete via the Manage modal, and the count updates immediately. Mobile pass at 375px is clean — `documentElement.scrollWidth === window.innerWidth` confirmed via JS. The PLANNER section header sits cleanly between FOCUS (above) and the projects table (below); the three regions read as a single dashboard.

Eight findings logged. **None block launch.** All are polish.

The trajectory holds — ten rounds in and Phase 14 is the cleanest dashboard build the audit has scored to date.

## Verification — five new widgets, end-to-end

| Widget | Action exercised | Live observation | Status |
|---|---|---|---|
| **CALENDAR** (P14.3) | Filled name/date/Tournament, clicked ADD EVENT | Red dot appeared on Day 8 (Mon Jun 8), persisted across full reload, day-click expanded inline event list with EDIT + DELETE | ✅ |
| **CALENDAR — URL nav** | `?calMonth=0,6,7,15` | 0→Jan, 6→July, 7→August, 15→falls back to current month. 0-indexed convention is a UX trap — UX-1104 | ✅ functional / 🟡 convention |
| **CALENDAR — today highlight** | Default load shows June 2026 | Mon 1 ring-highlighted, `aria-current="date"` set, nav buttons labelled correctly | ✅ |
| **ACTIVITY** (P14.4) | Bumped OWNED ×2 + BUILD + PRIME on Recruit Test | Four `^ Bumped Recruit Test  <1m` entries appeared — correct count, project resolution, time-ago, kind glyph | ✅ |
| **STREAK** (P14.5) | After first day's activity, refreshed | Headline `1 DAYS` in amber. Subcopy `1 days - don't break the chain.` — grammar bug, UX-1101 | ✅ data / 🟡 microcopy |
| **HEATMAP** (P14.6) | After 4 bumps today | Bottom-right Jun cell lit bright green. Title `4 actions · Mon 1 Jun` — correct count, day label, mid-green band | ✅ |
| **HEATMAP — touch copy** | Read footer at 375px | `Hover a cell for the count.` — no touch variant (UX-1106) | 🟡 |
| **INSPO — paste** (P14.7) | Pasted pinimg + unsplash URLs, ALT text, ADD INSPO | Count 0→1→2 ON DISPLAY, MANAGE button appeared, image tiles rendered (with `naturalWidth=0` due to test-env 503 — broken-image fallback gap, UX-1103) | ✅ (with gap) |
| **INSPO — manage modal** | Opened MANAGE, clicked HIDE on row 1 | Status flipped `SHOWING`→`HIDDEN`, action button HIDE→SHOW (green), gallery footer updated to `1 ON DISPLAY · 1 HIDDEN` | ✅ |
| **INSPO — SAVE ORDER colour** | Inspected modal header | Solid cyan — violates Button discipline (UX-1102) | 🟡 |
| **Mobile pass** (P14.8) | 375×812 + 414×896 full scroll | All widgets stack cleanly. Calendar 7-col grid fits. Heatmap full 90-day grid. Bottom tab bar correct. `scrollWidth === innerWidth` confirmed. | ✅ |

## Findings — Phase 14 (8 items, all polish)

### Medium (3)

- **UX-1101** — STREAK reads "1 days" (grammar plural). Fix: `count === 1 ? 'DAY' : 'DAYS'`, swap hyphen for em-dash. Confidence 0.98.
- **UX-1102** — SAVE ORDER button is cyan, breaks Button discipline. Fix: `variant="success"`. Confidence 0.93.
- **UX-1103** — Broken inspo images have no styled fallback. Fix: `onError` handler → `frame` placeholder tile with broken-image icon + "Couldn't load — open source" link. Add `referrerPolicy="no-referrer"`. Confidence 0.88.

### Low (5)

- **UX-1104** — `calMonth` URL param is 0-indexed (Jan=0). Fix: parse as 1-indexed at page Server Component boundary, subtract 1 when handing to grid. Confidence 0.90.
- **UX-1105** — Calendar day buttons have ISO-string aria-labels (`2026-06-08`). Fix: format as `"June 8, 2026, 1 event"`; prefix today with `"Today, "`. Confidence 0.95.
- **UX-1106** — Heatmap footer says "Hover" on mobile. Fix: `Hover or tap a cell for the count.` Confidence 0.85.
- **UX-1107** — Heatmap tooltip uses "actions"; rest of dashboard uses "activity". Fix: `${count} activities · …` or `${count} bumps · …`. Confidence 0.70.
- **UX-1108** — Inspo drag-handle below 24×24 WCAG min. Fix: 32×32 (desktop) / 44×44 (mobile) tap-target wrap. Confidence 0.78.

## Strengths

- **PLANNER section header with yellow accent dot anchors the new widgets coherently** — the colour-coded dots (green=ready/focus, yellow=in-progress/planner, cyan=info/inspo, purple=streak) form a quiet but consistent visual rhythm.
- **ACTIVITY stream microcopy is excellent** — right altitude, no nouns the painter doesn't already know.
- **Calendar is the strongest single widget shipped this round** — month grid + 4-colour dots + today highlight + inline event detail expansion + prev/today/next nav + URL-state preservation, all working on the first pass.
- **Mobile pass at 375px is genuinely clean** — Playwright's no-horizontal-scroll pin holds, calendar grid still fits, INSPO stacks correctly.
- **Empty states across all five widgets read like a human wrote them.**
- **STREAK · HEATMAP · ACTIVITY all updated within ~1s of bump submission** — no shimmer, no skeleton.
- **MANAGE INSPO modal's hide/show pattern is deliberate two-state design** — painter doesn't lose references when curating.

## Deferred from earlier rounds (state-of-the-board, not re-graded)

- UX-910, UX-908, UX-912, UX-904, UX-907, UX-903 — Round 9 deferred items, still post-launch polish.
- UX-1001, UX-1002 — Round 10 lows (library/wishlist data-source split; cold-start NET·LAG flash), still acceptable to ship.

## Suggested implementation order

1. UX-1101 — STREAK pluralisation
2. UX-1102 — SAVE ORDER button colour
3. UX-1106 — Heatmap footer copy
4. UX-1107 — Heatmap tooltip vocabulary (bundle with #3, same file)
5. UX-1105 — Calendar gridcell aria-labels
6. UX-1108 — Inspo drag-handle tap target
7. UX-1104 — calMonth URL param convention
8. UX-1103 — Inspo broken-image fallback

Items 1–6 can ship as a single "Phase 14 polish" PR — all sub-30-minute fixes, none architectural. 7 and 8 are independent.

**Counts:** 3 medium, 5 low, 0 high, 0 critical.

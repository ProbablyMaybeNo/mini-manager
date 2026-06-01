# Launch Checklist

Single source of truth for "what does Ross need to do before recruits land?" Pulls together V2-BUILD-PLAN §14, the credential rotation playbook, the Stripe ship-checklist, the recruit DM template, and the residual P-phase polish items. Living doc — strike items as they ship.

## §14 ship-ready criteria (from V2-BUILD-PLAN)

| # | Criterion | Status |
|---|---|---|
| 1 | Every primary flow (§6, all 9) executable end-to-end on desktop AND mobile | ✅ Confirmed via 9 Playwright missions + Phase 12 rebuild |
| 2 | Lighthouse 90+ mobile / 95+ desktop on `/`, `/library`, `/projects`, `/recipes/[id]`, `/tools/eyedropper` | ⚠️ Desktop ✓ at last run; mobile 4 of 5 routes ✓, 3 routes 87-89 (LCP-bound) |
| 3 | 0 TypeScript errors | ✅ Every commit ticks `tsc --noEmit` clean |
| 4 | E2E coverage on flows 1, 2, 3 (the core) | ✅ M1/M2/M3 + M4 + M6 + M9 + M7 (import) — currently M7.1 needs a selector update post-P12 |
| 5 | Ross uses it as his only paint-planning tool 4 weeks | ⏳ **Ross-side** — start the clock |
| 6 | 10 r/minipainting recruits tested; 7 say "I'd pay for this" | ⏳ **Ross-side** — see `docs/RECRUIT_DM.md` |

## Outstanding code work

### Round 7 UI fixes (ui-builder running)
- R7-1 project table inline editing
- R7-2 app-wide small-button sweep
- R7-3 ColorPicker lightness slider
- R7-4 Tools "Start with..." color picker
- R7-5 Library top-right random button verification
- R7-6 Cyan-buttons survivor sweep
- R7-7 Recipe page button sweep

→ See `docs/UI_BACKLOG_R7.md`. Agent in flight as of 2026-06-01. Reports back automatically.

### Round 7 UX audit (ux-auditor running)
Deep dive against live URL, "is this launch-ready?" framing. Will write `ux-audit/findings_v7.json` + report. Includes onboarding gap audit + mobile breakdown + accessibility sweep.

### Phase 10 — Stripe pricing gates (deferred until Ross creates Stripe account)
- See `docs/PHASE10_PLAN.md` for 8 milestones
- **Ross-side prerequisite:** create Stripe account + 3 products (Pro Monthly $4 / Pro Lifetime $29 / Founder $19) + copy 5 env vars into Vercel
- Once env vars are in place, fire `milestone-builder docs/PHASE10_PLAN.md --max 8`

### Known test failure (low priority)
- `qa_imports.spec.ts M7.1` — expects `<h1>` with project name after applying an import. Phase 12 P12.8 added ProjectHeaderStrip with the h1, so the assertion should match. Failure may be in the Apply server action or the redirect target. **Not blocking launch** — import is a power-user feature, not a primary flow. Fix during the next test sweep.

## Ross's side — pre-launch tasks

### ⚠️ Critical (must do before recruits land)

- [ ] **Revoke exposed credentials.** See `docs/CREDENTIAL_ROTATION.md`. ~20 min total.
  - [ ] PSI API key (Google Cloud Console → Credentials → 🗑️) — leaked in chat history during Lighthouse audit
  - [ ] Turso JWT (pasted during early setup)
  - [ ] Resend API key
  - [ ] Groq API key
  - [ ] `AUTH_SECRET` regeneration (invalidates all current sessions — you'll be signed out)

### Important (do before launch)

- [ ] **Run Lighthouse audit** post-Round-7 work. Use `node scripts/audit-lighthouse.mjs` with a fresh PSI key. Bank numbers in `docs/PERFORMANCE_AUDIT.md`. If mobile still misses 90 on `/`, `/library`, `/projects`, chase the LCP fix (preload critical fonts is the cheapest win).
- [ ] **Stripe account + products** — Steps 1-4 of the ship checklist in `docs/PHASE10_PLAN.md`. ~10 min, no wiring needed until you fire milestone-builder.
- [ ] **Custom domain** — `minimaster.app` or similar, ~$10-15/yr. Vercel project settings → Domains → Add. DNS at registrar.

### Nice-to-have (post-launch polish)

- [ ] **Marketing landing page** at `/` (currently redirects to /sign-in) — Phase 13 if you want one before recruits.
- [ ] **PWA install + offline** — post-launch.

## Recruit launch sequence

When code + credentials are clean:

1. **Personal smoke test** — sign up fresh, walk every primary flow end-to-end on prod. Screenshot anything weird.
2. **4-week solo dogfood** — use Mini Manager as your only paint-planning tool. Track gaps in a notes file or directly in the app.
3. **Reddit post + DMs** — `docs/RECRUIT_DM.md` has the templates. Post to r/minipainting first; if <5 sign-ups in 24h, fan out to faction subs.
4. **Track feedback** in a simple table (10 row minimum). 7-of-10 "I'd pay for this" is the launch gate.

## Files referenced

- `docs/PHASE10_PLAN.md` — Stripe pricing gates (8 milestones)
- `docs/PHASE11_PLAN.md` — App-wide UX overhaul (14 milestones, ✅ shipped)
- `docs/PHASE12_PLAN.md` — Color-first rebuild (24 milestones, ✅ shipped)
- `docs/UI_BACKLOG_R7.md` — Round 7 fixes (7 items, ui-builder running)
- `docs/CREDENTIAL_ROTATION.md` — Credential rotation playbook
- `docs/RECRUIT_DM.md` — Reddit + DM templates
- `docs/PERFORMANCE_AUDIT.md` — Lighthouse baseline + measurement table
- `ux-audit/findings_v[1-7].json` — UX audit history

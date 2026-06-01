# UI Builder Backlog — Round 9

Post-Phase-13 audit verdict (2026-06-01) was 🟡 launch with caveats. Items 1-7 from `ux-audit/report_v9.md` are the path to 🟢 unambiguous launch. Top-7 cluster lands here.

## Items in scope

### Top-7 — ship before recruits land

- [ ] **UX-905 — Remove duplicate title in ColorPicker drawer header.** ColorPicker drawer renders its title twice (e.g. "MATCH TARGET" header bar + "MATCH TARGET" h2 below). Same on /tools/gradient. Fix: drop the inner heading OR repurpose as descriptive sub-label ("Editing: Shadow slot"). Files: `src/components/ui/ColorPickerDialog.tsx` + downstream consumers. _trivial · medium severity_

- [ ] **UX-913 — `/auth/signout` 404.** Direct nav to `/auth/signout` 404s. Leftover NextAuth URL. Fix: middleware redirect to `/user`, OR implement as a real signout route handler. _trivial · low severity_

- [ ] **UX-911 — Tooltip on NET·LAG indicator.** Status bar flips `NET ON` → `NET LAG` (amber) during slow actions, no tooltip. Recruits will worry. Fix: add `title`/aria tooltip — "Server's responding slower than usual. Your work is still saving." Optionally debounce to only show after >1500ms. _trivial · low severity_

- [ ] **UX-909 — Autocomplete attributes on sign-up + sign-in.** Browser pre-fills /sign-up PASSWORD with saved password from another site. Fix: add `autocomplete="new-password"` on both /sign-up password fields; `autocomplete="username"` on USERNAME inputs; `autocomplete="current-password"` on /sign-in PASSWORD. _trivial · low severity_

- [ ] **UX-902 — Disable capped + buttons + fire inline error.** On a fresh project, pressing `b` or clicking `+` on BUILD does nothing because BUILD cannot exceed OWNED (0). No visual feedback. The same red inline error exists for Paint/Prime — system has messaging, just doesn't fire on this path. Fix: visually disable + buttons whose target is capped (greyed-out, `aria-disabled`, cursor not-allowed) AND fire the inline red error on capped attempts. Files: `src/components/StageCounter.tsx` + adjacent. _small · high severity_

- [ ] **UX-906 — Initialize ColorPicker drawer to field's current value.** Drawer opens with stale color (`#47D1D1` cyan leftover from another session) instead of the field's current value (`#072547`). User can't tell their existing color is preserved if they hit CLOSE. Fix: initialize wheel position, hex, and lightness slider to the field's current value on drawer open. _small · medium severity_

- [ ] **UX-901 — Mobile /projects table stack-card reflow.** WCAG 2.2 §1.4.10 — at 375 and 414 viewports, /projects table is horizontal-scroll; COMPLETION and DELETE columns clip off-screen. Fix: stacked-card layout at ≤768px (name as title, type badge inline, recipe swatches inline, status pill below, completion as full-width progress bar, delete as kebab menu). OR hide PRIORITY+COMPLETION columns on mobile and reveal on row tap. _small · high severity_

### Deferred (post-launch / recruit-feedback window)

- UX-910 Library paint name truncation on mobile (trivial · low)
- UX-908 ColorPicker library-match sort + ΔE cap (small · low)
- UX-912 Slot swatch tint vs label hex consistency (trivial · low, needs Ross's eye)
- UX-904 Unified attach-recipe modal across surfaces (medium · medium)
- UX-907 Multi-recipe tab control on FOCUS / leaf workspace (medium · medium)
- UX-903 Server telemetry + soft toast on recipe-assign error (medium · medium, intermittent — needs reproduction)

## Conventions

- Standard ui-builder loop (see `~/.claude/agents/ui-builder.md`).
- One commit per item where practical. UX-901 (mobile reflow) may need 2 commits.
- Tests INTO feature commit. No orphans.
- `npm test` stays green (baseline: 1182 passed / 1 skipped).
- Typecheck clean before every commit.
- Use existing primitives + `@theme` tokens.
- Solid-fill Button discipline (P13.1) — no `[ ]` brackets on action buttons.
- Cyan banned from action buttons.
- Local commit only — Billy pushes.

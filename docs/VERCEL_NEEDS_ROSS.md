# Vercel comments — Ross's decision queue

**Snapshot:** 2026-07-06 · **Project:** mini-manager (`prj_YyXdoYrGrIiJxECmHx2AmYKWTEZ3`) · **Prod:** miniaturemanager.vercel.app
**3 unresolved threads** need your call. This is the single durable home for the "blocked / needs-Ross" list — the `vercel-comment-loop` routine regenerates it each run. Thread links: `https://vercel.com/rkhilarysignups-8609s-projects/mini-manager/c/<id>`.

> **This run (2026-07-06):** shipped 3 clear, bounded fixes (PR #82 → `main`, CI-gated, resolved after prod verify) — `Tcylyd5enVXT` (landing purple text/PRO-panel/triangle bullets → neon green), `Z2r21cCQAPQr` (pricing FOUNDER tier purple → neon green), `8myNPt4auK8V` (landing page background → solid black to match the logo). Also repaired a pre-existing `package-lock.json` drift (missing `esbuild@0.28.1` subtree) that was failing `npm ci` in CI on `main` itself. The 3 threads below all carry an open question already put to Ross in prior runs — no new clarification was needed, they're just still waiting on an answer.

---

## 🔴 NEEDS YOUR CALL

| Thread | Page | Ask | Why it's open / question asked |
|---|---|---|---|
| `trogZqV-Yo8w` | /collection | Rebuild +ADD MODEL / +ADD PAINT into a full modal: AUTO-ADD URL paste **+** MANUAL-ADD form (name, game, faction, price, project dropdown, status) → save into the table; plus an edit pencil next to the X on each row. | Substantial feature (new modal layout, manual-entry form + validation, an edit/update flow, a new row action) — beyond the safe auto-fix scope. Needs a dedicated build + your sign-off on the field set. Asked: confirm the manual fields, and should the edit pencil reuse the same modal pre-filled? |
| `d0MWLSNNjDTd` | /collection | Simplify the stats bar (drop "COLLECTION" title; format as `PAINT: 00 OWNED 00 WISHLIST $00 TOTAL SPENT [REMAINING] / MODELS: 00 WISHLIST 00 OWNED 00 COMPLETE $00 TOTAL SPENT [REMAINING]`; drop progress tracking here) **and** a new per-project budget feature. | The relabel is locked and shippable EXCEPT the `REMAINING` field has no data source without the budget feature. Asked: for `REMAINING`, do you want (a) it to mean total cost of WISHLIST (not-yet-bought) items — shippable now — or (b) hold `REMAINING` until the per-project budget feature lands? The moment you pick, the relabel ships on its own; budgeting stays a separate feature. |
| `8Wxk5lw0uh5c` | /tools/stacking | "Add layer button doesn't do anything — either remove it or make it add another circle." | Can't reproduce from source: the **+ Add layer** button is wired and appends a Layer N block (hex + opacity), enabled up to 6 layers. Two things make it feel dead — the new block inserts *above* the button (button slides down, new layer lands off-screen), and the predicted-result Venn only renders 2 circles. Asked: when you click it, does no new Layer block appear at all — or did you expect a 3rd Venn circle rather than a layer row? |

---

## 🟢 SHIPPED THIS RUN (resolved after prod verify)

| Thread | Page | Change | Files |
|---|---|---|---|
| `Tcylyd5enVXT` | / (landing) | "Free to start…" heading, PRO panel accent/label, and PRO-perk triangle bullets: purple → neon green (`--color-green`) | `src/components/public/LandingView.tsx` |
| `Z2r21cCQAPQr` | /pricing | Featured (FOUNDER) tier: panel accent + border, "Limited seat" chip, seats progress bar: purple → neon green | `src/components/public/PricingView.tsx` |
| `8myNPt4auK8V` | / (landing) | Landing canvas → solid black to match the pure-black logo (app `--color-bg` `#0d0d17` read faintly blue); scoped to the landing page only | `src/components/public/LandingView.tsx` |

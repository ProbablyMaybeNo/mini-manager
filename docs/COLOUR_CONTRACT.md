# The Mini Mainframe — Colour Contract (HEX.CODE v2)

**Status:** APPROVED (Ross, 2026-07-03) · resolves audit finding **UX-007**

The palette is spent on **signal, never decoration**. Neutral/white is the default;
a colour appears only where it carries meaning the word + icon don't already. This is
the locked set — six working colours (four accents + a three-tone priority ramp) on a
white-on-dark base, down from eight hues each doing three jobs.

---

## 1. The palette (final)

| Role | Colour | Hex | Notes |
|---|---|---|---|
| **Loud / important** | cyan | `#00F5FF` | The pop. Primary CTA (dark text on the bright fill), active nav tab, active filter chip, focus rings, logo/brand. The one colour that draws the eye to "act here." |
| **Quiet / links** | blue | `#4AA8DA` | Lower-hierarchy interactive: inline links, labels, section text, chevrons. A rung below cyan by design (2-tier accent, Ross 2026-07-05) so cyan owns the spotlight. ~7:1 on the dark bg. |
| **Done** | green | `#09CD7E` | COMPLETE, progress-fill, success, ✓ |
| **Danger** | red | `#F7143E` | Delete, remove, error. The only saturated red. |
| **Not-yet / low-stakes** | yellow | `#F5F17A` | WISHLIST status, wishlist add, Low priority |
| **Priority — Low** | butter | `#FAFF94` | ramp only |
| **Priority — Med** | peach | `#FCBB7E` | ramp only |
| **Priority — High** | brick red | `#E23B3B` | warm true-red — deliberately distinct from danger `#F7143E` |
| **Base / everything else** | white on dark | `--fg` / `--fg-bright` | text, secondary buttons, +Attach, entity types, borders |

**Retired:** `cyan` (→ replaced by blue), `purple`, saturated `orange` (its pastel lives on
as Med-priority), `pink`. A colour with no job is retired, not forced into one.

---

## 2. Text — white by default

Most sites grey out secondary text to fake a hierarchy; done past the WCAG floor it just
becomes unreadable. We get hierarchy from **size, weight, spacing, and position** instead,
and keep the text white.

- **Everything a user reads → white** (`--fg` / `--fg-bright`). Hierarchy = type scale, not dimming.
- **Grey is allowed in exactly two functional cases**, and only at a tone that still clears 4.5:1:
  - **Disabled** controls/fields — a live-looking white control that can't be used is a lie.
  - **Placeholder** text in an empty input — must read as *not-yet-typed*, distinct from real input.
- `SHELVED` / on-hold / backlog rows keep the same dim treatment (they're the inactive state —
  the same "de-emphasised, not gone" signal as disabled).

---

## 3. Status — coloured bookends, calm middle

The pipeline's two ends carry colour; the working middle is white. The `STATUS_LABEL`
word + the progress bar already carry stage granularity, so mid-stages don't each need a hue.

| Status | Colour | Why |
|---|---|---|
| WISHLIST | **yellow** | "don't own it yet" — spot at a glance what's still to buy |
| OWNED, BUILDING, PRIMING, PAINTING, BASING | **white / neutral** | have it, in progress — the calm middle |
| COMPLETE | **green** | done |
| SHELVED | **dim** | inactive / on hold |

---

## 4. Actions

- **Blue** = primary/affirmative, **red** = destructive, **everything else neutral** (outline / plain).
- Retire the coloured "+": `variant="add"` (green) and `variant="attach"` (purple) stop encoding
  by hue → `primary` (blue) or `secondary` (neutral outline). The "+" glyph + label already says "add."
- Wishlist add → **yellow** stays (real semantic, yellow owns it).

---

## 5. Priority

A self-contained severity ramp with its **own tokens** (values now differ from the semantic
accents, so it no longer borrows red/orange/yellow):

Low `#FAFF94` → Med `#FCBB7E` → High `#E23B3B`. Muted enough to read as *ranking*; High stays
distinct from danger red.

---

## 6. Entity type

Type is a category label, not a state → **icon + neutral chip, no hue.** Retire
`projectTypeAccent`'s rainbow.

---

## 7. Code migration

### Tokens — `src/app/globals.css`
- Repoint `--cyan` to `#0B78B3`; add `--cyan-lite: #4aa8da` (+ `text-cyan-lite` utility) for text/links on dark.
  *(Token key stays `cyan` to avoid a 54-file class rename; comment it as "brand blue." A later rename pass can make the name honest.)*
- Repoint `--red` to `#F7143E`.
- Add priority tokens `--priority-low/med/high` (`#FAFF94 / #FCBB7E / #E23B3B`) + `text-*`/`bg-*`/`border-*` utilities.
- Add a **`neutral`** accent (white text, `--border` outline, no glow) for status-middle + type chips.
- Update token comments to the single meanings; drop the purple/orange/pink glow tokens once unused.

### Maps — `src/lib/palette.ts`
- Extend `Accent` with `neutral`; add its rows to `accentText/Bg/Border/Dot/TextGlow`.
- `statusAccent`: WISHLIST `yellow`, COMPLETE `green`, SHELVED `dim`, **all others → `neutral`**.
- `priorityAccent`: point Low/Med/High at the new `--priority-*` tokens (own keys, not the shared accents).
- `projectTypeAccent`: every type → `neutral`.
- `cyan` entries render blue automatically (token repointed) — no per-map change needed for brand.

### Components
- `src/components/kit/Button.tsx` — fold `add`→`primary`(blue); `attach`→`secondary`(neutral); keep `addWishlist`(yellow) + `danger`(red). Disabled state uses the grey token.
- Inputs — placeholder colour = the grey token (not white).
- Call-site sweep — every `variant="add"` / `variant="attach"`, `projectTypeAccent` consumer (TypeChip), blue-as-link.

### Verify
`npx tsc --noEmit` → 0 · unit + integration + e2e green · commit to `redesign/v2-hexcode` (no deploy until Ross sees it live).

---

## 8. Decorative colour systems — Phase 2 (decided)

Ross: *"do whatever's best, there should be some colour though — at least on the calendar."*
Ruling: **keep colour where it's glanceable, calm the busy surfaces, retire purple + orange.**

- **Calendar** (`eventKindAccent`) — **keep full colour** (explicit ask; colour-by-kind is genuinely
  scannable here): tournament → `blue`, deadline → `red`, battle → `yellow`, other → `green` *(was purple)*.
- **Stat boxes** (`statBoxAccents`) — active → `blue`, completion → `green`, streak → `yellow`,
  time → `neutral` *(was purple)*. Keeps the meaningful readouts coloured, drops the odd hue.
- **Activity feed** (`activityAccent`) — cart → `yellow` (spend), check → `green` (done);
  add / build / prime / paint → `neutral` (the icon carries the rest). Calms the row-rainbow.

After this, `purple` and `orange` are unused everywhere → **retire both tokens** (and their glow tokens).

Runs as a second pass *after* Phase 1 (§7) commits, since both edit `src/lib/palette.ts`.

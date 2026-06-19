# Vercel comments — triage (overnight 2026-06-19)

23 unresolved threads at time of writing. Triaged below. Thread ids in `()`.
Nothing here is auto-resolved — resolution happens after Ross confirms + prod is
verified (per `docs/AGENT_ONBOARDING.md`).

## ✅ Addressed tonight (verify on prod, then resolve)

- **Inspo URLs not rendering as images** (`ddHIyiq3YqFG`) — FIXED. og:image
  resolver so Pinterest/IG/ArtStation page links render as thumbnails. (PR #35)
- **Venn diagram gone from Stacking** (`Rm4pY3fLzz6k`, `WKEG10G3FccH`) — PARTIAL.
  Venn diagram **restored** + the **broken stacking colour selectors fixed**
  (Pick buttons now open the picker). PR #35. **Still pending:** the glaze-combo
  *suggestion* feature both comments ask for ("magenta is a great undercoat for
  yellow; blue adds coldness, red adds warmth") — that's a new content/feature
  build, see Features below. Reply but leave open until that ships.

## 🟡 Clear + low-risk, but need element targeting

These are concrete token/text/className tweaks. The threads don't carry a clean
page path, so each needs its `context.selector` read (via get_toolbar_thread) or
Ross pointing at the element before a safe edit.

- Background has "crept toward blue", should be solid black (`T4nuELRRnFtJ`) —
  likely the faint cyan scanline gradient on `body` in `globals.css` reading as
  blue. Needs Ross: keep scanlines but cut the tint, or go fully black?
- Side-panel background → pure black like the main section + logo (`BRFouQHNaUUx`).
- "Make this text bright white" (`1Xq1P5W3Yvzq`).
- Page subtitle text → bright white **and** more informative (write real
  per-page descriptions) (`mWGF8f6O1IEQ`).
- Bigger font for the harmony dropdown + brand names, nothing else (`2tgkNEd6g32w`).
- PRIORITY indicator font should match STATUS and TYPE (`U3vAGGyt-AjD`).
- Heading hierarchy: indicator text too big; column headers = H3, table/box
  titles = H2, page titles = H1 (`0uxze0Chc7dB`).

## ⚠️ "+ Attach" / button-font cluster — CONFLICTS with the new font system

Multiple comments ask to standardise add/attach buttons as **pastel purple "+
Attach"** with the **VT323 font** (`9lgIwII2oBy7`, `foqbcZx93a6F`, `t7doCednL8MP`,
`CiBUwVgwwQRD`, `5qy6mswKnugb`). Two issues to resolve with Ross first:
1. **Font conflict:** these predate the Theme Studio — Ross just set the button
   font to **DePixel Klein**, not VT323. Applying VT323 to buttons would override
   the brand-new button font. Need a ruling: button font = DePixel Klein (keep) or
   VT323 (these comments)?
2. The attach-affordance consolidation overlaps the design-system audit
   (`docs/UI_CONSISTENCY_AUDIT.md` → "attach / add-item affordance"). Do them
   together as one "+ Attach everywhere" pass.

## 🔵 Features / bigger builds (need a session, not a tweak)

- Glaze-combo **suggestions** in the venn/stacking tool (`Rm4pY3fLzz6k`,
  `WKEG10G3FccH`) — a curated table of undercoat/glaze advice.
- +/- **droppers** in the layering tool: start with 3, add/remove; move Save /
  Send-to-Recipe right (`wBJeqQHQLK4g`).
- Bigger paint/colour squares + **brand acronym** badges so names aren't cut off
  (`9OIIQF3jUrz2`).
- Bigger **WISHLIST/OWNED indicators** on the colour map for at-a-glance coverage
  (`rg1uauzAsVG4`).
- Skip the recipe-name slide-out — "+ RECIPE" goes straight to the create page
  (`TXjhrdKPsrda`).
- Add one more paint brand for grid symmetry (`C9gZQOzR7nUM`) — data + Ross's call.

## 🟣 Needs Figma / a design call from Ross

- Make these "more stylistic, refer to moodboard, Figma group 20" (`S3lZ40vuocCL`).
- "Make this section smaller + scrollable" — which section? (`UF5HOwXMpJxP`).
- Swap the recipe-box text order to "RECIPE BOX" then "No Recipe Attached"
  (`RuYiw7plQqDV`).

## Recommendation

The fastest path through the 🟡 cluster is to read each thread's `context.selector`
(get_toolbar_thread) to pin the exact element, then batch them. The ⚠️ cluster is
blocked on the button-font ruling. I'd pair the font ruling + "+ Attach everywhere"
+ the design-system attach item into one consolidation pass.

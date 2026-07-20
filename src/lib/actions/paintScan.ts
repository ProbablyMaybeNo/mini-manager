"use server";

import { z } from "zod";
import { currentUserId } from "@/lib/auth-stub";
import { getServerCatalog } from "@/lib/paints/serverCatalog";
import { scanPaintLabels } from "@/lib/ai/paintScan";
import { matchScannedPaints, type PaintScanMatch } from "@/lib/paints/matchScan";
import { SCAN_ACCEPTED_TYPES } from "@/lib/paints/scanLimits";
import { enforceDailyLimit, paintScanDailyLimit, RateLimitBucket } from "@/lib/rateLimit/quota";
import { isProUser } from "@/lib/billing/enforce";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * "Scan paints from a photo" — Claude Haiku vision -> catalog match
 * pipeline shared by TWO surfaces with different gating:
 *
 *   - "collection" — the Collection page's photo entry point. This is base
 *     Collection tracking (docs/SUBSCRIPTION_PAYWALL.md free bucket) — free.
 *   - "tool" — the Tools hub's Paint Scanner (/tools/scan), one of the
 *     `/tools/*` power tools — subscriber-only.
 *
 * Defaults to "tool" (the gated, higher-friction option) so a caller that
 * forgets to pass `surface` fails closed rather than silently opening a
 * free bypass.
 *
 * The photo never touches disk/DB: the client posts a base64 payload
 * straight through and it's discarded once this call returns (privacy +
 * simplicity — it's a scan, not an upload).
 *
 * This action only extracts + matches; it never writes. Bulk-adding the
 * CONFIRMED matches to Collection is a separate step the client drives via
 * the EXISTING `bulkAddPaintsToCollection` action
 * (src/lib/actions/paintOwnership.ts) — same write path the Library grid's
 * bulk-select bar already uses, so ownership + the Library<->Collection
 * sync stay correct with no new persistence code.
 */

const scanSchema = z.object({
  imageBase64: z.string().min(1).max(7_500_000),
  mediaType: z.enum(SCAN_ACCEPTED_TYPES),
  surface: z.enum(["collection", "tool"]).default("tool"),
});

export async function scanPaintsFromPhoto(
  raw: z.input<typeof scanSchema>,
): Promise<ActionResult<{ items: PaintScanMatch[] }>> {
  const parsed = scanSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid photo" };
  }
  const userId = await currentUserId();

  // Gating-layer — only the Tools-hub Paint Scanner surface is subscriber
  // gated; the Collection page's photo scan stays free. Gate BEFORE the
  // daily-quota check and the vision call so a non-subscriber never burns
  // either.
  if (parsed.data.surface === "tool" && !(await isProUser(userId))) {
    return {
      ok: false,
      error: "Paint Scanner is a Pro feature. Upgrade to scan paint labels.",
      upgradeUrl: "/pricing",
    };
  }

  // Per-user daily quota (E7 pattern) — metered before the paid Haiku
  // vision call so an over-limit user is refused without burning it.
  const quota = await enforceDailyLimit(RateLimitBucket.PaintScan, userId, paintScanDailyLimit());
  if (!quota.allowed) {
    return {
      ok: false,
      error: `You've hit today's paint-scan limit (${quota.limit}/day). It resets tomorrow.`,
    };
  }

  const extracted = await scanPaintLabels(parsed.data.imageBase64, parsed.data.mediaType);
  if (extracted.length === 0) {
    return {
      ok: false,
      error: "Couldn't read any paint labels in that photo — try a closer, well-lit shot.",
    };
  }

  const catalog = await getServerCatalog();
  const items = matchScannedPaints(extracted, catalog);
  return { ok: true, data: { items } };
}

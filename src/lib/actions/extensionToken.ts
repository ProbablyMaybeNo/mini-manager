"use server";

import { currentUserId } from "@/lib/auth-stub";
import {
  issueExtensionToken,
  regenerateExtensionToken,
} from "@/lib/auth/extensionToken";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Server actions backing the Settings → "Browser extension" section.
 *
 * Generating and regenerating both return the full token string for the
 * user to copy. Generate signs the user's CURRENT token version (so
 * re-clicking "Generate" is idempotent); Regenerate bumps the version,
 * which invalidates any token the user previously pasted into the
 * extension.
 */

/** Issue (or re-show) the current personal extension token. */
export async function generateExtensionToken(): Promise<ActionResult<string>> {
  const userId = await currentUserId();
  const token = await issueExtensionToken(userId);
  if (!token) return { ok: false, error: "Could not issue a token" };
  await trackServer(AnalyticsEvent.ExtensionTokenCreated, { mode: "generate" });
  return { ok: true, data: token };
}

/** Rotate the personal extension token, revoking all previous ones. */
export async function rotateExtensionToken(): Promise<ActionResult<string>> {
  const userId = await currentUserId();
  const token = await regenerateExtensionToken(userId);
  if (!token) return { ok: false, error: "Could not regenerate the token" };
  await trackServer(AnalyticsEvent.ExtensionTokenCreated, { mode: "rotate" });
  return { ok: true, data: token };
}

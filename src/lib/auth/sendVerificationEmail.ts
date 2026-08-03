import "server-only";
import {
  enforceWindowedLimit,
  OUTBOUND_EMAIL_WINDOW_MS,
  outboundEmailWindowLimit,
  RateLimitBucket,
} from "@/lib/rateLimit/quota";

/**
 * Resend-backed one-shot mailer. Used by:
 *   - P9.5 — recovery-email verification
 *   - P9.6 — password reset
 *   - P9.x — signup verification (+ its resend)
 *
 * If `AUTH_RESEND_KEY` is missing (local dev), we console-log the link
 * instead of throwing — same DX as the legacy magic-link transport.
 *
 * **R2-19 — this is the mail chokepoint.** It is the only module in `src/`
 * that talks to a mail provider, so the per-recipient cap below bounds every
 * caller that exists and every one that doesn't yet: no future email feature
 * can ship unthrottled by omission. It is defence in depth, not the primary
 * control — each caller still throttles its own entry point.
 */
export interface VerifyMail {
  to: string;
  subject: string;
  /** Plain-text body. The HTML body wraps this in a minimal <p>. */
  text: string;
  /** Optional override HTML body. Generated from `text` if omitted. */
  html?: string;
}

/**
 * Per-recipient send budget. Deliberately SILENT — it reports a verdict
 * instead of throwing, so callers keep the failure modes they already have
 * and `requestPasswordReset` keeps returning its enumeration-safe ok:true
 * without knowing this exists.
 *
 * Fails OPEN if the counter itself errors: this sits behind each caller's
 * own limiter, and a fail-closed backstop whose broken state is "the app can
 * never send mail again" is a worse outage than the abuse it prevents.
 */
async function withinSendBudget(to: string): Promise<boolean> {
  // Normalise the key. The address as typed is not what identifies the
  // inbox — `Alice@x.com ` and `alice@x.com` must share one budget, or the
  // cap is trivially sidestepped by re-casing the target.
  const subject = to.trim().toLowerCase();
  if (!subject) return true;
  try {
    const gate = await enforceWindowedLimit(
      RateLimitBucket.OutboundEmail,
      subject,
      outboundEmailWindowLimit(),
      OUTBOUND_EMAIL_WINDOW_MS,
    );
    return gate.allowed;
  } catch (err) {
    console.error(
      "[mail] send-budget check failed, allowing the send:",
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

export async function sendVerificationEmail(mail: VerifyMail): Promise<void> {
  const from =
    process.env.AUTH_EMAIL_FROM ?? "Mini Mainframe <no-reply@localhost>";

  if (!(await withinSendBudget(mail.to))) {
    // Not an error: the caller's own limiter is the thing that should
    // normally stop this, so reaching here is worth a log line but must not
    // change any caller's return value.
    console.warn(
      `[mail] suppressed "${mail.subject}" to ${mail.to} — recipient send budget exhausted`,
    );
    return;
  }

  if (!process.env.AUTH_RESEND_KEY) {
    console.log(
      [
        "",
        "┌─ MINI MAINFRAME · VERIFICATION MAIL ─────────────────",
        `│ to:      ${mail.to}`,
        `│ subject: ${mail.subject}`,
        `│ body:    ${mail.text.replace(/\n/g, " | ")}`,
        "└──────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html:
        mail.html ??
        `<p>${escapeHtml(mail.text).replace(/\n/g, "<br/>")}</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

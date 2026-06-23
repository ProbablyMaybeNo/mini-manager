import "server-only";

/**
 * Resend-backed one-shot mailer. Used by:
 *   - P9.5 — recovery-email verification
 *   - P9.6 — password reset
 *
 * If `AUTH_RESEND_KEY` is missing (local dev), we console-log the link
 * instead of throwing — same DX as the legacy magic-link transport.
 */
export interface VerifyMail {
  to: string;
  subject: string;
  /** Plain-text body. The HTML body wraps this in a minimal <p>. */
  text: string;
  /** Optional override HTML body. Generated from `text` if omitted. */
  html?: string;
}

export async function sendVerificationEmail(mail: VerifyMail): Promise<void> {
  const from =
    process.env.AUTH_EMAIL_FROM ?? "Mini Mainframe <no-reply@localhost>";

  if (!process.env.AUTH_RESEND_KEY) {
    // eslint-disable-next-line no-console
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

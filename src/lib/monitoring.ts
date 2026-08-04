import type { captureException } from "@sentry/nextjs";

type CaptureScope = NonNullable<Parameters<typeof captureException>[1]>;

/**
 * R3-1 — correlate the two Sentry events one server crash produces.
 *
 * A server-side render failure is reported twice: `onRequestError` ->
 * `Sentry.captureRequestError` emits a full SERVER event (real message, real
 * stack, request context), and the React boundary that Next.js then renders
 * emits a CLIENT event via `Sentry.captureException`. In production the client
 * one is deliberately redacted by Next.js down to a fixed placeholder message
 * ("The specific message is omitted in production builds…"), so the two reports
 * look unrelated — and worse, EVERY server crash lands in the same client issue
 * because they all share that one message.
 *
 * `error.digest` is the only thing that survives the redaction, and Next.js
 * assigns it to the thrown error BEFORE calling `onRequestError`
 * (create-error-handler.js), so the same value identifies both halves. Attaching
 * it:
 *
 *   - as a TAG, so `digest:<value>` finds the pair (and matches the digest
 *     Next.js prints in the server log line for that request);
 *   - as a FINGERPRINT alongside `{{ default }}`, so distinct server errors stop
 *     collapsing into one client issue.
 *
 * Deliberately a tag and nothing else. R2-21 locked `dataCollection` down
 * (`httpBodies: []`, `userInfo: false`, `genAI.inputs: false`) so sign-in POST
 * bodies never travel; a digest is a hash of message + stack, carries no user
 * data, and needs none of that relaxed to be useful.
 *
 * Returns `undefined` when there is no digest — a purely client-side crash has
 * no server half to correlate with, and forcing a fingerprint would only break
 * Sentry's default grouping.
 */
export function scopeForDigest(digest: string | undefined): CaptureScope | undefined {
  if (!digest) return undefined;
  return { tags: { digest }, fingerprint: ["{{ default }}", digest] };
}

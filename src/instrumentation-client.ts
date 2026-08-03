// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aa39c7f4ae31d79048da7b151eda63a6@o4511742045323264.ingest.us.sentry.io/4511742054694912",

  // Errors are captured at 100%; perf traces off for launch (free-tier quota).
  tracesSampleRate: 0,

  // Session Replay intentionally omitted for launch — it records user sessions
  // (extra client bundle weight + its own privacy disclosure). Add deliberately
  // later if we want it.

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // R2-21 — this block must stay populated. The SDK branches on whether the
  // `dataCollection` key is PRESENT: present-but-empty resolves every unset
  // field to the permissive DEFAULTS (userInfo on, httpBodies = all four
  // targets, genAI in/out on), not the conservative sendDefaultPii=false set.
  // The scaffold's fully-commented-out block was therefore opting us in.
  dataCollection: {
    userInfo: false,
    // Never attach request/response bodies: sign-in and sign-up POST plaintext
    // credentials, and the SDK's "keys and tokens are always filtered"
    // guarantee is scoped to key-value surfaces, not to bodies.
    httpBodies: [],
    // Prompts are user content with no diagnostic value; model outputs stay on
    // because a malformed response is a real failure mode.
    genAI: { inputs: false },
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

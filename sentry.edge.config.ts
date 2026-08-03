// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aa39c7f4ae31d79048da7b151eda63a6@o4511742045323264.ingest.us.sentry.io/4511742054694912",

  // Errors are always captured at 100%; this governs only perf transactions,
  // which we don't need for launch (0 keeps the free-tier quota for real errors).
  tracesSampleRate: 0,

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

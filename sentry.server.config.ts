// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aa39c7f4ae31d79048da7b151eda63a6@o4511742045323264.ingest.us.sentry.io/4511742054694912",

  // Errors are always captured at 100%; this governs only perf transactions,
  // which we don't need for launch (0 keeps the free-tier quota for real errors).
  tracesSampleRate: 0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // stackFrameVariables is deliberately not set: in @sentry/nextjs 10.65.0
  // nothing reads the resolved value. Local-variable capture is gated on the
  // separate `includeLocalVariables` option, which we leave unset — so capture
  // is off and setting stackFrameVariables here would be a placebo. Don't turn
  // `includeLocalVariables` on without re-reading the auth actions: they hold
  // a plaintext `input.password` local across an await that can throw.
  //
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

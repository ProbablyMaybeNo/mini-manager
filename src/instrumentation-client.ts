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

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

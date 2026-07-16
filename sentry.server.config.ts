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

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

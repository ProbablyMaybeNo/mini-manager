/**
 * Funnel event names — the acquisition → activation journey we watch to
 * see the launch working end-to-end. Import-safe from both client and
 * server (no runtime deps), so both `@vercel/analytics` (client) and
 * `@vercel/analytics/server` calls key off the same constants.
 *
 * Fired via `trackServer()` (this dir's `track.server.ts`) in server
 * actions, or the client `track()` from `@vercel/analytics` in "use
 * client" components. Vercel Web Analytics aggregates these into custom-
 * event funnels in the dashboard.
 */
export const AnalyticsEvent = {
  /** Top of funnel — marketing surfaces. */
  LandingView: "landing_view",
  PricingView: "pricing_view",
  CtaStartForFree: "cta_start_for_free",
  /** Sign-up. */
  SignUpStarted: "sign_up_started",
  AccountCreated: "account_created",
  EmailVerified: "email_verified",
  /** First-touch acquisition source actually captured onto the account. */
  SourceCaptured: "source_captured",
  /** Activation milestones — first time the painter does each thing. */
  FirstProjectCreated: "first_project_created",
  FirstPaintOwned: "first_paint_owned",
  FirstRecipeCreated: "first_recipe_created",
  FirstFocusSession: "first_focus_session",
  /** Distribution — a recipe made public (the share/moat loop). */
  PublicRecipeShared: "public_recipe_shared",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** Vercel Analytics allows string | number | boolean | null property values. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

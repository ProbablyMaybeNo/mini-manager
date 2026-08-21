import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * G4 — support-email plumbing. A single SUPPORT_EMAIL constant with a
 * clearly-marked placeholder fallback, surfaced across the public surfaces.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const savedEnv = {
  pub: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  priv: process.env.SUPPORT_EMAIL,
};

beforeEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  delete process.env.SUPPORT_EMAIL;
});

afterEach(() => {
  if (savedEnv.pub === undefined) delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  else process.env.NEXT_PUBLIC_SUPPORT_EMAIL = savedEnv.pub;
  if (savedEnv.priv === undefined) delete process.env.SUPPORT_EMAIL;
  else process.env.SUPPORT_EMAIL = savedEnv.priv;
});

describe("SUPPORT_EMAIL constant", () => {
  test("falls back to the CHANGE_ME placeholder when unset", async () => {
    const { SUPPORT_EMAIL } = await import("@/lib/support");
    expect(SUPPORT_EMAIL).toBe("CHANGE_ME@mini-mainframe.com");
  });

  test("reads process.env.SUPPORT_EMAIL when set", async () => {
    process.env.SUPPORT_EMAIL = "help@example.com";
    const { SUPPORT_EMAIL } = await import("@/lib/support");
    expect(SUPPORT_EMAIL).toBe("help@example.com");
  });

  test("NEXT_PUBLIC_SUPPORT_EMAIL takes precedence (client-visible)", async () => {
    process.env.SUPPORT_EMAIL = "server@example.com";
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "public@example.com";
    const { SUPPORT_EMAIL, supportMailto } = await import("@/lib/support");
    expect(SUPPORT_EMAIL).toBe("public@example.com");
    expect(supportMailto()).toBe("mailto:public@example.com");
    expect(supportMailto("Help")).toBe("mailto:public@example.com?subject=Help");
  });
});

describe("SUPPORT_EMAIL is surfaced across the required surfaces", () => {
  const surfaces = [
    // The landing page's Contact link moved into the shared PublicFooter when
    // the SEO landing pages needed the same row; the surface still carries it,
    // one level down. The LandingView → PublicFooter edge is asserted below so
    // the chain can't be broken by dropping the footer from the page.
    "src/components/public/PublicFooter.tsx",
    "src/app/(app)/gallery/page.tsx",
    "src/app/r/[slug]/page.tsx",
    "src/app/(public)/privacy/page.tsx",
    "src/app/(public)/terms/page.tsx",
    "src/components/public/AuthView.tsx",
    "src/app/(public)/reset/page.tsx",
    "src/components/feedback/ReportIssueButton.tsx",
  ];

  test.each(surfaces)("%s references SUPPORT_EMAIL", (rel) => {
    const src = readFileSync(path.join(root, rel), "utf8");
    expect(src).toContain("SUPPORT_EMAIL");
  });

  test.each([
    "src/components/public/LandingView.tsx",
    "src/components/public/SeoLandingLayout.tsx",
  ])("%s renders the PublicFooter that carries it", (rel) => {
    const src = readFileSync(path.join(root, rel), "utf8");
    expect(src).toContain("<PublicFooter />");
  });
});

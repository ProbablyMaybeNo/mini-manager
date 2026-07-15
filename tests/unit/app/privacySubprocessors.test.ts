import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * G3 — the privacy policy must name the AI/analytics subprocessors so the
 * disclosure is accurate: Anthropic (recipe prompts + gallery moderation),
 * Groq (army-list text), and Vercel Analytics.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const privacy = readFileSync(
  path.join(root, "src/app/(public)/privacy/page.tsx"),
  "utf8",
);

describe("G3 privacy subprocessor disclosure", () => {
  test("names Anthropic, Groq, and Vercel Analytics", () => {
    expect(privacy).toContain("Anthropic");
    expect(privacy).toContain("Groq");
    expect(privacy).toContain("Vercel Analytics");
  });

  test("mentions what each AI subprocessor receives", () => {
    expect(privacy).toMatch(/army-list text/i);
    expect(privacy).toMatch(/moderation/i);
  });
});

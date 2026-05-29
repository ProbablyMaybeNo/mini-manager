import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The webShare helper is feature-detected at module evaluation time.
// We re-import the module inside each test so the freshly-mutated
// `navigator` is observed.

const ORIGINAL_NAVIGATOR = globalThis.navigator;

describe("nativeShare", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_NAVIGATOR) {
      Object.defineProperty(globalThis, "navigator", {
        value: ORIGINAL_NAVIGATOR,
        configurable: true,
      });
    }
  });

  test("returns false when navigator.share is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "test" },
      configurable: true,
    });

    const { isNativeShareSupported, nativeShare } = await import(
      "@/lib/share/webShare"
    );
    expect(isNativeShareSupported).toBe(false);
    expect(await nativeShare({ url: "https://example.com" })).toBe(false);
  });

  test("returns true when navigator.share resolves", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { share, userAgent: "test" },
      configurable: true,
    });

    const { isNativeShareSupported, nativeShare } = await import(
      "@/lib/share/webShare"
    );
    expect(isNativeShareSupported).toBe(true);
    const result = await nativeShare({
      title: "Recipe",
      text: "Look",
      url: "https://example.com",
    });
    expect(result).toBe(true);
    expect(share).toHaveBeenCalledWith({
      title: "Recipe",
      text: "Look",
      url: "https://example.com",
    });
  });

  test("treats AbortError as a completed share", async () => {
    const abort = new Error("user cancelled");
    abort.name = "AbortError";
    const share = vi.fn().mockRejectedValue(abort);
    Object.defineProperty(globalThis, "navigator", {
      value: { share, userAgent: "test" },
      configurable: true,
    });

    const { nativeShare } = await import("@/lib/share/webShare");
    expect(await nativeShare({ url: "https://example.com" })).toBe(true);
  });

  test("returns false when navigator.share rejects with a non-abort error", async () => {
    const denied = new Error("blocked");
    denied.name = "NotAllowedError";
    const share = vi.fn().mockRejectedValue(denied);
    Object.defineProperty(globalThis, "navigator", {
      value: { share, userAgent: "test" },
      configurable: true,
    });

    const { nativeShare } = await import("@/lib/share/webShare");
    expect(await nativeShare({ url: "https://example.com" })).toBe(false);
  });
});

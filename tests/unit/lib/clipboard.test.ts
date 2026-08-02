import { afterEach, describe, expect, test, vi } from "vitest";
import { copyText, type CopyTone } from "@/lib/clipboard";

/**
 * R2-1 — a rejected clipboard write must never produce a success toast.
 *
 * The live bug was an uncaught `NotAllowedError`: the call sites `void`ed
 * the promise and toasted "Copied {name} · {hex}" regardless, so the painter
 * was told a value was on their clipboard when the write had failed and the
 * hex was on screen nowhere else.
 */

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

/** Install a fake `navigator.clipboard` whose writeText behaves as given. */
function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(globalThis, "navigator", {
    value: writeText ? { clipboard: { writeText } } : {},
    configurable: true,
    writable: true,
  });
}

/** Collects every (message, tone) pair the code under test reports. */
function recorder() {
  const calls: { message: string; tone: CopyTone }[] = [];
  return {
    calls,
    report: (message: string, tone: CopyTone) => calls.push({ message, tone }),
  };
}

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

describe("copyText — success is conditional on the write resolving", () => {
  test("a resolved write reports the success message once, in green", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    const { calls, report } = recorder();

    const ok = await copyText("#AABBCC", report, {
      copied: "Copied Macragge Blue · #AABBCC",
      failed: "Couldn’t copy — Macragge Blue is #AABBCC",
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("#AABBCC");
    expect(calls).toEqual([
      { message: "Copied Macragge Blue · #AABBCC", tone: "green" },
    ]);
  });

  test("a rejected write fires NO success toast and surfaces the value", async () => {
    stubClipboard(async () => {
      // Exactly what the live console showed when the write was blocked.
      throw new DOMException("Write permission denied.", "NotAllowedError");
    });
    const { calls, report } = recorder();

    const ok = await copyText("#AABBCC", report, {
      copied: "Copied Macragge Blue · #AABBCC",
      failed: "Couldn’t copy — Macragge Blue is #AABBCC",
    });

    expect(ok).toBe(false);
    // The regression this test exists for: nothing may claim success.
    expect(calls.some((c) => c.message.startsWith("Copied"))).toBe(false);
    expect(calls.some((c) => c.tone === "green")).toBe(false);
    expect(calls).toEqual([
      { message: "Couldn’t copy — Macragge Blue is #AABBCC", tone: "red" },
    ]);
    // The value survives the failure — it's readable in the message.
    expect(calls[0]?.message).toContain("#AABBCC");
  });

  test("a rejected write never rejects back at the caller", async () => {
    stubClipboard(async () => {
      throw new Error("boom");
    });
    const { report } = recorder();

    // `void copyText(...)` at the call sites relies on this: an unhandled
    // rejection inside a transition is what tears the app down (see R2-2).
    await expect(
      copyText("#AABBCC", report, { copied: "c", failed: "f" }),
    ).resolves.toBe(false);
  });

  test("an absent Clipboard API takes the failure path rather than claiming success", async () => {
    stubClipboard(null);
    const { calls, report } = recorder();

    const ok = await copyText("#AABBCC", report, { copied: "c", failed: "f" });

    expect(ok).toBe(false);
    expect(calls).toEqual([{ message: "f", tone: "red" }]);
  });

  test("reports exactly once per call, whatever the outcome", async () => {
    stubClipboard(async () => {});
    const resolved = recorder();
    await copyText("a", resolved.report, { copied: "c", failed: "f" });
    expect(resolved.calls).toHaveLength(1);

    stubClipboard(async () => {
      throw new Error("nope");
    });
    const rejected = recorder();
    await copyText("a", rejected.report, { copied: "c", failed: "f" });
    expect(rejected.calls).toHaveLength(1);
  });
});

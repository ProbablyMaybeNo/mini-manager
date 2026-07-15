import { describe, expect, test } from "vitest";
import { createSingleFlightGuard } from "@/lib/guards/singleFlight";

describe("createSingleFlightGuard (E2)", () => {
  test("drops a second call while the first is in flight", async () => {
    const guard = createSingleFlightGuard();
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    // Start the first invocation; it parks on `gate` (still in flight).
    const first = guard(async () => {
      runs += 1;
      await gate;
    });

    // A near-instant second click — the guard must reject it before the
    // wrapped fn can run (mirrors a native double-click ~15ms apart).
    const second = await guard(async () => {
      runs += 1;
    });
    expect(second).toBe(false);
    expect(runs).toBe(1);

    // Let the first finish; the guard is free again.
    release();
    expect(await first).toBe(true);
    expect(runs).toBe(1);

    // A later call now runs normally.
    const third = await guard(async () => {
      runs += 1;
    });
    expect(third).toBe(true);
    expect(runs).toBe(2);
  });

  test("resets even when the wrapped fn throws", async () => {
    const guard = createSingleFlightGuard();
    await expect(
      guard(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Guard released — a subsequent call still runs.
    let ran = false;
    await guard(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

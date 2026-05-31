import { describe, expect, test } from "vitest";
import { toastReducer, MAX_VISIBLE, DEFAULT_DURATIONS, type Toast } from "@/components/ui/Toast";

function makeToast(id: string, partial: Partial<Toast> = {}): Toast {
  return {
    id,
    status: "success",
    message: "test",
    duration: 1000,
    ...partial,
  };
}

describe("toastReducer", () => {
  test("push appends to an empty stack", () => {
    const t = makeToast("a");
    expect(toastReducer([], { type: "push", toast: t })).toEqual([t]);
  });

  test("push appends in arrival order (newest last)", () => {
    const a = makeToast("a");
    const b = makeToast("b");
    const s1 = toastReducer([], { type: "push", toast: a });
    const s2 = toastReducer(s1, { type: "push", toast: b });
    expect(s2.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("dismiss removes by id without disturbing other entries", () => {
    const state = [makeToast("a"), makeToast("b"), makeToast("c")];
    expect(
      toastReducer(state, { type: "dismiss", id: "b" }).map((t) => t.id),
    ).toEqual(["a", "c"]);
  });

  test("dismiss on a missing id is a no-op", () => {
    const state = [makeToast("a"), makeToast("b")];
    expect(
      toastReducer(state, { type: "dismiss", id: "zzz" }).map((t) => t.id),
    ).toEqual(["a", "b"]);
  });

  test("push past MAX_VISIBLE drops the oldest non-error", () => {
    const initial = Array.from({ length: MAX_VISIBLE }, (_, i) =>
      makeToast(`t${i}`, { status: i === 1 ? "error" : "success" }),
    );
    const next = toastReducer(initial, {
      type: "push",
      toast: makeToast("newest", { status: "success" }),
    });
    expect(next).toHaveLength(MAX_VISIBLE);
    // t0 (success, oldest) should have been the one dropped — t1 was an error.
    expect(next.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "newest"]);
  });

  test("push past MAX_VISIBLE in an all-error stack drops the oldest anyway", () => {
    const initial = Array.from({ length: MAX_VISIBLE }, (_, i) =>
      makeToast(`e${i}`, { status: "error" }),
    );
    const next = toastReducer(initial, {
      type: "push",
      toast: makeToast("new-err", { status: "error" }),
    });
    expect(next).toHaveLength(MAX_VISIBLE);
    expect(next[0]!.id).toBe("e1"); // e0 dropped
    expect(next.at(-1)!.id).toBe("new-err");
  });
});

describe("DEFAULT_DURATIONS", () => {
  test("error toasts are sticky (null duration)", () => {
    expect(DEFAULT_DURATIONS.error).toBeNull();
  });

  test("success + info auto-dismiss quickly, warning lingers longer", () => {
    expect(DEFAULT_DURATIONS.success).toBe(3500);
    expect(DEFAULT_DURATIONS.info).toBe(3500);
    expect(DEFAULT_DURATIONS.warning).toBeGreaterThan(DEFAULT_DURATIONS.success!);
  });
});

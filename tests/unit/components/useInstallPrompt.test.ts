import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * R3-4 — `useInstallPrompt.promptInstall` was the fifth of the stuck-flag
 * awaits R2-15 fixed, and the only one wrapping a browser API instead of a
 * server action. `deferred` doubles as the in-flight flag (`canInstall` is
 * `deferred !== null`), and it was cleared only on the line AFTER the two
 * awaits — so a rejected `prompt()` or `userChoice` left it set and the
 * install button on screen, wired to an event that is single-use and now
 * spent. Dead control until reload.
 *
 * The product call, since a browser API's failure has no obvious UI: HIDE the
 * button. These rejections mean the offer is gone, the gesture context was
 * lost, or the app is already installed — none of which the painter can act
 * on, so an error message would be a dead end. `canInstall` therefore goes
 * false on every terminal outcome, and the rejection is reported as
 * "unavailable" so InstallBanner declines to write its permanent dismissal
 * flag and the offer can return on a later visit.
 *
 * The unit project runs in `node`: no DOM, no react-dom, no renderer. So the
 * hook is driven directly through a slot-backed React stub — the same
 * "call the component as a plain function" trick
 * tests/unit/app/errorBoundaryReporting.test.ts uses for useEffect, extended
 * with real useState slots so the flag being cleared is observable.
 */

let slots: unknown[] = [];
let cursor = 0;
let effectRan = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <S>(initial: S): [S, (next: S | ((prev: S) => S)) => void] => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i] as S,
        (next) => {
          slots[i] =
            typeof next === "function"
              ? (next as (prev: S) => S)(slots[i] as S)
              : next;
        },
      ];
    },
    useCallback: <F>(fn: F): F => fn,
    useEffect: (effect: () => void) => {
      // Mount effect only — the hook's deps are `[]`, so re-renders must not
      // re-register the listeners.
      if (effectRan) return;
      effectRan = true;
      effect();
    },
  };
});

// Imported AFTER the mock is registered.
const { useInstallPrompt } = await import("@/components/pwa/useInstallPrompt");

type Outcome = "accepted" | "dismissed";

interface StubInstallEvent {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: Outcome }>;
}

const listeners = new Map<string, (e: Event) => void>();

/** A render pass: rewind the slot cursor and call the hook again. */
function render() {
  cursor = 0;
  // rules-of-hooks exists to protect the real renderer's call-order contract.
  // There is no renderer here — React is stubbed above with slot-backed state,
  // and honouring the rule (renaming this `use*`) would just move the same
  // complaint onto every call site inside the test bodies.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useInstallPrompt();
}

/** Chromium offering an install — the event the hook stashes. */
function fireInstallOffer(event: StubInstallEvent) {
  const listener = listeners.get("beforeinstallprompt");
  if (!listener) throw new Error("hook never registered beforeinstallprompt");
  listener(event as unknown as Event);
}

function offer(over: Partial<StubInstallEvent> = {}): StubInstallEvent {
  return {
    preventDefault: () => {},
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome: "accepted" as Outcome }),
    ...over,
  };
}

beforeEach(() => {
  slots = [];
  cursor = 0;
  effectRan = false;
  listeners.clear();
  // Not a webdriver and not already standalone, so the hook actually arms.
  vi.stubGlobal("navigator", { webdriver: false });
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: (e: Event) => void) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type: string) => {
      listeners.delete(type);
    },
    matchMedia: () => ({ matches: false }),
    navigator: {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInstallPrompt — arming", () => {
  test("stays hidden until the browser actually offers an install", () => {
    expect(render().canInstall).toBe(false);
  });

  test("reveals the control once beforeinstallprompt fires", () => {
    render();
    fireInstallOffer(offer());
    expect(render().canInstall).toBe(true);
  });

  test("promptInstall is a safe no-op with nothing stashed", async () => {
    const { promptInstall } = render();
    await expect(promptInstall()).resolves.toBe("unavailable");
  });
});

describe("R3-4 promptInstall never leaves the control stuck in-flight", () => {
  // Built lazily: a rejected promise created in the `test.each` table would sit
  // unhandled from collection time until the test awaits it.
  test.each<[string, () => Partial<StubInstallEvent>]>([
    [
      "prompt() rejects",
      () => ({ prompt: () => Promise.reject(new Error("spent")) }),
    ],
    [
      "userChoice rejects",
      () => ({ userChoice: Promise.reject(new Error("withdrawn")) }),
    ],
  ])("%s — reports unavailable and hides the button", async (_name, build) => {
    render();
    fireInstallOffer(offer(build()));

    const { canInstall, promptInstall } = render();
    expect(canInstall).toBe(true);

    // Before the fix this rejection escaped, `deferred` was never cleared, and
    // the button stayed visible bound to an already-spent event.
    await expect(promptInstall()).resolves.toBe("unavailable");

    expect(render().canInstall).toBe(false);
  });

  test.each<Outcome>(["accepted", "dismissed"])(
    "a %s prompt still returns the outcome and retires the event",
    async (outcome) => {
      render();
      fireInstallOffer(offer({ userChoice: Promise.resolve({ outcome }) }));

      const { promptInstall } = render();
      await expect(promptInstall()).resolves.toBe(outcome);

      // beforeinstallprompt is single-use whatever the user chose.
      expect(render().canInstall).toBe(false);
    },
  );

  test("a second call after a rejection is inert rather than throwing", async () => {
    render();
    fireInstallOffer(offer({ prompt: () => Promise.reject(new Error("spent")) }));

    await render().promptInstall();
    // The control is gone by now, but a queued click must not explode.
    await expect(render().promptInstall()).resolves.toBe("unavailable");
  });
});

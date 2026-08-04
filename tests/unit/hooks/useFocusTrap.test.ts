// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * R3-5 — the trap must hold in BOTH directions from the state it opens in.
 *
 * `useFocusTrap` (SlideOutPanel, ProjectBottomSheet, ModalDialog) opens by
 * focusing the container, then wrapped Tab only at the two ends of
 * `container.querySelectorAll(...)`. That list is DESCENDANTS only, so the
 * container is never in it: on first open `document.activeElement` matched
 * neither end, no branch fired, and the keydown fell through to the browser.
 * Forward landed on the first control by luck (the container precedes its
 * children in DOM order); backward left the dialog for the page behind it.
 *
 * What this file can and cannot prove: happy-dom has no native Tab traversal,
 * so these tests exercise the handler's decisions — which is exactly the code
 * that changed — but the fall-through itself only shows up in a real browser.
 * The proof that a real `Shift+Tab` now stays inside is
 * `tests/e2e/qa_dialog_focus_trap.spec.ts`, and it must stay that way: a
 * programmatic `.focus()` never reaches this handler and passes either way.
 *
 * The unit project runs in `node` with no renderer, so the hook is driven
 * directly through a slot-backed React stub — the same trick
 * tests/unit/components/useInstallPrompt.test.ts uses.
 */

let refSlots: { current: unknown }[] = [];
let cursor = 0;
let cleanups: (() => void)[] = [];

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: <T>(initial: T) => {
      const i = cursor++;
      refSlots[i] ??= { current: initial };
      return refSlots[i] as { current: T };
    },
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    },
  };
});

// Imported AFTER the mock is registered.
const { useFocusTrap } = await import("@/hooks/useFocusTrap");

const DIALOG_HTML = `
  <button id="outside-before">before</button>
  <div id="dialog" tabindex="-1">
    <button id="close">✕</button>
    <input id="field" />
    <button id="apply">Apply</button>
  </div>
  <button id="outside-after">after</button>
`;

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`no #${id} in the test DOM`);
  return node;
}

/** Mount the trap over `html` and return the container it guards. */
function arm(html: string, onClose: () => void = () => {}): HTMLElement {
  document.body.innerHTML = html;
  const container = el("dialog");
  cursor = 0;
  // rules-of-hooks protects the real renderer's call-order contract. There is
  // no renderer here — React is stubbed above.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useFocusTrap({ current: container }, true, onClose);
  return container;
}

/** A real keydown, the way a keyboard delivers it. */
function press(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  refSlots = [];
  cursor = 0;
  cleanups = [];
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const cleanup of cleanups) cleanup();
});

describe("useFocusTrap", () => {
  test("opens by focusing the container, which is not one of the focusables", () => {
    const container = arm(DIALOG_HTML);
    expect(document.activeElement).toBe(container);
    expect(
      [...container.querySelectorAll("*")].includes(container as Element),
    ).toBe(false);
  });

  test("Shift+Tab from the freshly-opened state goes to the LAST control, not out", () => {
    arm(DIALOG_HTML);
    const event = press("Tab", true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("apply"));
  });

  test("Tab from the freshly-opened state goes to the first control", () => {
    arm(DIALOG_HTML);
    const event = press("Tab");
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("close"));
  });

  test("wraps at both ends once focus is on a control", () => {
    arm(DIALOG_HTML);
    el("apply").focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("close"));

    expect(press("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("apply"));
  });

  test("leaves the middle of the run to the browser's own order", () => {
    arm(DIALOG_HTML);
    el("field").focus();
    expect(press("Tab").defaultPrevented).toBe(false);
    expect(press("Tab", true).defaultPrevented).toBe(false);
  });

  test("pulls focus back in if it has drifted outside the container", () => {
    arm(DIALOG_HTML);
    el("outside-after").focus();
    expect(press("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("apply"));

    el("outside-before").focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el("close"));
  });

  test("a container with no reachable control still swallows Tab", () => {
    const container = arm(`<div id="dialog" tabindex="-1"><p>nothing here</p></div>
      <button id="outside-after">after</button>`);
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
    expect(press("Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
  });

  test("Escape closes and teardown returns focus to the opener", () => {
    document.body.innerHTML = DIALOG_HTML;
    el("outside-before").focus();
    const onClose = vi.fn();

    cursor = 0;
    useFocusTrap({ current: el("dialog") }, true, onClose);
    expect(document.activeElement).toBe(el("dialog"));

    press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);

    for (const cleanup of cleanups.splice(0)) cleanup();
    expect(document.activeElement).toBe(el("outside-before"));
    press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does nothing while disabled", () => {
    document.body.innerHTML = DIALOG_HTML;
    el("outside-before").focus();
    cursor = 0;
    useFocusTrap({ current: el("dialog") }, false, () => {});
    expect(document.activeElement).toBe(el("outside-before"));
    expect(press("Tab", true).defaultPrevented).toBe(false);
  });
});

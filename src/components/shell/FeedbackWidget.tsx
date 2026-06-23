"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Listbox, ModalDialog, type ListboxOption } from "@/components/kit";

type Status = "idle" | "submitting" | "done" | "error";

// Mirrors the `feedbackCategories` enum in @/db/schema. Kept as a local
// const so this client component never imports the schema module (which
// pulls drizzle + nanoid into the client bundle). The route re-validates
// against the real enum, so this list is presentational only.
type FeedbackCategory = "bug" | "idea" | "other";

const CATEGORY_OPTIONS: ListboxOption<FeedbackCategory>[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

/**
 * Tester "Report an issue" widget — a subtle floating button (bottom-right)
 * that opens a kit ModalDialog with a message textarea, an optional category,
 * and a Submit. Auto-captures the current path so triagers know where the
 * tester was. Posts to /api/feedback (DB-only).
 *
 * Rendered in the AUTHED app shell only. Never auto-opens — button-triggered
 * exclusively. Hidden from automated browsers (`navigator.webdriver`) so it
 * stays out of E2E/screenshot runs.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isBot, setIsBot] = useState(true);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  // Resolve `navigator.webdriver` client-side only (it's undefined on the
  // server). Until mounted we render nothing, so the widget never flashes
  // for crawlers / Playwright.
  useEffect(() => {
    setMounted(true);
    setIsBot(Boolean(navigator.webdriver));
  }, []);

  function reset() {
    setMessage("");
    setCategory("bug");
    setStatus("idle");
    setError(null);
  }

  function close() {
    setOpen(false);
    // Let the close animation settle before clearing the body.
    reset();
  }

  async function submit() {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setError("Add a short note before submitting.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          category,
          pageUrl: pathname,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Submit failed");
      }
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Submit failed");
    }
  }

  if (!mounted || isBot) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        title="Report an issue"
        className="fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 border border-cyan/50 bg-bg/90 px-3 py-2 font-button text-button uppercase tracking-[0.15em] text-cyan/80 shadow-[0_0_18px_rgba(0,210,255,0.12)] backdrop-blur-sm transition-[color,border-color,box-shadow] duration-150 hover:border-cyan hover:text-cyan hover:shadow-[0_0_22px_rgba(0,210,255,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-safe:hover:-translate-y-px"
      >
        <span aria-hidden>▸</span>
        <span className="hidden sm:inline">Report</span>
      </button>

      <ModalDialog
        open={open}
        onClose={close}
        breadcrumb="Tester Feedback"
        title="Report an issue"
        width="max-w-md"
        footer={
          status === "done" ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-body text-body text-green">
                Thanks — logged ✓
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={close}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Sending…" : "Submit"}
              </Button>
            </div>
          )
        }
      >
        {status === "done" ? (
          <p className="font-body text-body text-fg">
            Your report was logged with the page you were on. Thanks for helping
            test The Mini Mainframe.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="label-osd text-fg">
                What went wrong / your idea
              </label>
              <textarea
                id={fieldId}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                autoFocus
                placeholder="Describe the issue or idea…"
                aria-invalid={error ? true : undefined}
                className="w-full resize-y border border-cyan/50 bg-bg px-2 py-1.5 font-body text-body text-fg placeholder:text-fg-faint transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:shadow-[0_0_0_3px_rgba(0,210,255,0.12)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="label-osd text-fg">Category</span>
              <Listbox<FeedbackCategory>
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={setCategory}
                ariaLabel="Feedback category"
                size="md"
              />
            </div>

            <p className="font-body text-body text-fg-faint">
              Captured automatically: <span className="text-fg-dim">{pathname}</span>
            </p>

            {error && (
              <p className="font-body text-body text-red" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </ModalDialog>
    </>
  );
}

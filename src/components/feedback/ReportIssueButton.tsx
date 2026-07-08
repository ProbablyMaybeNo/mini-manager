"use client";

import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { Button, Input, Listbox, ModalDialog } from "@/components/kit";
import { cn } from "@/lib/cn";

const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
type Severity = (typeof SEVERITIES)[number];

/**
 * Side-menu "Report an Issue" entry, rendered below the Tutorial button.
 * Styled to read as a nav item (matching {@link TourReplayButton}) but it's a
 * real button — it opens a dialog that posts to /api/feedback, which files the
 * report as a card in the Notion "Testing Task Tracker". The current page URL
 * and browser are attached automatically.
 */
export function ReportIssueButton({
  onNavigate,
  className,
}: {
  /** Called when the dialog opens — lets the mobile menu close itself. */
  onNavigate?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState<Severity>("Medium");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [freeForever, setFreeForever] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    // Reset after the close animation so the form is fresh next time.
    window.setTimeout(() => {
      setTitle("");
      setDetails("");
      setSeverity("Medium");
      setState("idle");
      setFreeForever(false);
      setError(null);
    }, 200);
  }

  async function submit() {
    if (!title.trim() && !details.trim()) {
      setError("Add a short description first.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          details: details.trim(),
          severity,
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as {
        ok?: boolean;
        error?: string;
        freeForever?: boolean;
      };
      if (res.ok && data.ok) {
        if (data.freeForever) setFreeForever(true);
        setState("sent");
      } else {
        setState("idle");
        setError(data.error ?? "Couldn’t submit. Please try again.");
      }
    } catch {
      setState("idle");
      setError("Couldn’t submit. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onNavigate?.();
        }}
        className={cn(
          // Mirror the Tutorial entry's nav-item styling (icon+label, mono),
          // with a red hover so it reads as the "something's wrong" affordance.
          "flex min-h-11 w-full items-center gap-3 pl-5 pr-3 text-left font-mono text-[13px] uppercase tracking-wide text-fg transition-colors hover:bg-red/5 hover:text-red",
          className,
        )}
      >
        <MessageSquarePlus size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        Feedback
      </button>

      <ModalDialog
        open={open}
        onClose={close}
        breadcrumb="MINI MAINFRAME"
        title="Feedback"
      >
        {state === "sent" ? (
          <div className="flex flex-col gap-3">
            <p className="font-body text-body text-green text-glow-green">
              {freeForever
                ? "🎉 You’re FREE FOREVER — thanks for helping test. Your account keeps full access for good."
                : "▸ Thanks — your report was logged. We’re on it."}
            </p>
            <Button onClick={close} className="self-start">
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              label="Summary"
              name="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Progress bar doesn’t update"
            />
            <label className="flex flex-col gap-1">
              <span className="label-osd text-fg-dim">What happened?</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder="What you expected, what actually happened, and how to reproduce it…"
                className="w-full resize-y border border-cyan/40 bg-bg px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-osd text-fg-dim">Severity</span>
              <Listbox
                value={severity}
                ariaLabel="Severity"
                options={SEVERITIES.map((s) => ({ value: s, label: s.toUpperCase() }))}
                onChange={(s) => setSeverity(s)}
              />
            </label>
            {error && <p className="font-body text-body text-red-text">▸ {error}</p>}
            <div className="flex gap-2">
              <Button onClick={submit} disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send report"}
              </Button>
              <Button variant="tertiary" onClick={close}>
                Cancel
              </Button>
            </div>
            <p className="font-body text-[0.65rem] leading-tight text-fg-dim">
              Your current page and browser are attached automatically.
            </p>
          </div>
        )}
      </ModalDialog>
    </>
  );
}

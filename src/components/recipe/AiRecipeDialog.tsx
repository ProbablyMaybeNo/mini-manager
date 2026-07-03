"use client";

import { useState } from "react";
import { Button, ModalDialog, Swatch, useToast } from "@/components/kit";
import { readableText } from "@/lib/color";
import type {
  GroundedRecipeProposal,
  GroundedSlot,
} from "@/lib/ai/recipeSchema";

/**
 * The AI Recipe Creator surface.
 *
 * Flow: command textbox → POST /api/recipe/ai → confirmation card (proposed
 * paint chips + roles + technique summary) with Approve / Tweak / Regenerate.
 * Every paint shown is catalog-grounded server-side, so the chips are real
 * paints with real ids. Owned vs needs-to-buy is marked per chip, with an
 * "Add missing to wishlist" affordance.
 *
 * The dialog is presentational + fetch-only; the host owns persistence:
 *   - onApprove(proposal): build the recipe (fill slots + technique notes)
 *   - onAddMissing(paintIds): add the buy-list to the wishlist
 *
 * Pro gating is enforced on the server (402); a 402 here renders the inline
 * upgrade prompt rather than a recipe.
 */

const PROMPT_SUGGESTIONS = [
  "Ultramarines space marine, Citadel paints",
  "Rusty steampunk automaton, metallics and washes",
  "Forest goblin skin and leather, Vallejo",
];

type Phase = "compose" | "loading" | "review" | "upgrade";

export function AiRecipeDialog({
  open,
  onClose,
  onApprove,
  onAddMissing,
}: {
  open: boolean;
  onClose: () => void;
  /** Build the recipe from the approved proposal. Returns when persisted. */
  onApprove: (proposal: GroundedRecipeProposal) => void | Promise<void>;
  /** Add the not-owned catalog paints to the wishlist. */
  onAddMissing: (paintIds: string[]) => void | Promise<void>;
}) {
  const { toast, node } = useToast();
  const [phase, setPhase] = useState<Phase>("compose");
  const [command, setCommand] = useState("");
  const [proposal, setProposal] = useState<GroundedRecipeProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPhase("compose");
    setCommand("");
    setProposal(null);
    setError(null);
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function generate() {
    const cmd = command.trim();
    if (!cmd) {
      setError("Describe what you want to paint.");
      return;
    }
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/recipe/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      if (res.status === 402) {
        setPhase("upgrade");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        proposal?: GroundedRecipeProposal;
        error?: string;
      };
      if (!res.ok || !data.proposal) {
        setError(data.error ?? "Couldn’t generate a recipe. Try rephrasing.");
        setPhase("compose");
        return;
      }
      setProposal(data.proposal);
      setPhase("review");
    } catch {
      setError("Network error — please try again.");
      setPhase("compose");
    }
  }

  async function approve() {
    if (!proposal) return;
    setBusy(true);
    try {
      await onApprove(proposal);
    } finally {
      setBusy(false);
    }
  }

  async function addMissing() {
    if (!proposal || proposal.missingPaintIds.length === 0) return;
    setBusy(true);
    try {
      await onAddMissing(proposal.missingPaintIds);
      toast("Added missing paints to your wishlist", "green");
    } finally {
      setBusy(false);
    }
  }

  const footer = renderFooter();

  return (
    <>
      <ModalDialog
        open={open}
        onClose={close}
        title="GENERATE WITH AI"
        breadcrumb="RECIPE ▸ AI"
        width="max-w-lg"
        footer={footer}
      >
        {phase === "upgrade" ? (
          <UpgradePrompt />
        ) : phase === "review" && proposal ? (
          <ReviewCard proposal={proposal} />
        ) : (
          <ComposeForm
            command={command}
            onCommand={setCommand}
            error={error}
            loading={phase === "loading"}
            onSubmit={generate}
          />
        )}
      </ModalDialog>
      {node}
    </>
  );

  function renderFooter() {
    if (phase === "upgrade") {
      return (
        <div className="flex justify-end gap-2">
          <Button variant="tertiary" onClick={close}>
            Close
          </Button>
          <a href="/pricing" className="contents">
            <Button variant="solidCyan">See Pro</Button>
          </a>
        </div>
      );
    }
    if (phase === "review" && proposal) {
      const missingCount = proposal.missingPaintIds.length;
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {missingCount > 0 && (
            <Button variant="addWishlist" onClick={addMissing} disabled={busy}>
              + Wishlist {missingCount} missing
            </Button>
          )}
          <Button variant="tertiary" onClick={() => setPhase("compose")} disabled={busy}>
            Tweak
          </Button>
          <Button variant="secondary" onClick={generate} disabled={busy}>
            Regenerate
          </Button>
          <Button variant="add" onClick={approve} disabled={busy}>
            {busy ? "Saving…" : "Approve"}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex justify-end gap-2">
        <Button variant="tertiary" onClick={close}>
          Cancel
        </Button>
        <Button variant="solidCyan" onClick={generate} disabled={phase === "loading"}>
          {phase === "loading" ? "Generating…" : "✨ Generate"}
        </Button>
      </div>
    );
  }
}

function ComposeForm({
  command,
  onCommand,
  error,
  loading,
  onSubmit,
}: {
  command: string;
  onCommand: (v: string) => void;
  error: string | null;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="label-osd text-fg" htmlFor="ai-command">
        Describe the scheme
      </label>
      <textarea
        id="ai-command"
        value={command}
        onChange={(e) => onCommand(e.target.value)}
        disabled={loading}
        rows={3}
        maxLength={600}
        placeholder="e.g. Blood Angels space marine with battle damage, Citadel paints"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
        }}
        className="w-full resize-y border border-cyan/40 bg-bg p-2 font-body text-body text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
      />
      {error && <p className="font-body text-body text-red">▸ {error}</p>}
      <div className="flex flex-col gap-1">
        <span className="label-osd text-fg-dim">Try</span>
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onCommand(s)}
              disabled={loading}
              className="border border-cyan/30 px-2 py-1 font-body text-[0.7rem] text-fg-dim hover:border-cyan hover:text-cyan"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <p className="font-body text-[0.7rem] text-fg-faint">
        AI only picks from the real paint catalog — it never invents paints.
      </p>
    </div>
  );
}

function ReviewCard({ proposal }: { proposal: GroundedRecipeProposal }) {
  return (
    <div className="flex flex-col gap-3">
      {proposal.summary && (
        <p className="font-body text-body text-fg">{proposal.summary}</p>
      )}
      <div className="flex flex-col gap-1.5">
        {proposal.slots.map((slot, i) => (
          <SlotChip key={`${slot.paintId}-${i}`} slot={slot} />
        ))}
      </div>
      {proposal.techniqueNotes && (
        <div className="border-t border-cyan/20 pt-2">
          <span className="label-osd text-fg-dim">Technique</span>
          <p className="mt-1 whitespace-pre-wrap font-body text-[0.78rem] text-fg">
            {proposal.techniqueNotes}
          </p>
        </div>
      )}
      <p className="font-body text-[0.7rem] text-fg-faint">
        {proposal.slots.length} paints ·{" "}
        {proposal.missingPaintIds.length === 0
          ? "you own them all"
          : `${proposal.missingPaintIds.length} to buy`}
      </p>
    </div>
  );
}

function SlotChip({ slot }: { slot: GroundedSlot }) {
  return (
    <div className="flex items-center gap-2 border border-cyan/20 bg-bg/40 px-2 py-1.5">
      <Swatch hex={slot.hex} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="px-1 py-0.5 text-[0.6rem] uppercase tracking-[0.12em]"
            style={{ backgroundColor: slot.hex, color: readableText(slot.hex) }}
          >
            {slot.role.replace(/_/g, " ")}
          </span>
          <span className="truncate font-body text-[0.78rem] text-fg">
            {slot.brand} {slot.name}
          </span>
        </div>
        {slot.note && (
          <p className="truncate font-body text-[0.68rem] text-fg-dim">{slot.note}</p>
        )}
      </div>
      <span
        className={
          slot.owned
            ? "shrink-0 font-body text-[0.62rem] uppercase tracking-[0.1em] text-green"
            : "shrink-0 font-body text-[0.62rem] uppercase tracking-[0.1em] text-yellow"
        }
      >
        {slot.owned ? "owned" : "buy"}
      </span>
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="flex flex-col gap-3 py-2 text-center">
      <span aria-hidden className="font-osd text-3xl text-cyan/50">
        ✨
      </span>
      <p className="label-osd tracking-[0.18em] text-fg">PRO FEATURE</p>
      <p className="mx-auto max-w-sm font-body text-body text-fg">
        The AI Recipe Creator generates catalog-grounded paint recipes from a plain-language
        prompt. Upgrade to Pro to use it.
      </p>
    </div>
  );
}

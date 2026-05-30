"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  AttachRecipeModal,
  type RecipeOption,
} from "@/components/recipes/AttachRecipeModal";

interface BaseProps {
  candidates: ReadonlyArray<RecipeOption>;
  label?: string;
  variant?: "primary" | "subtle";
}

interface ProjectProps extends BaseProps {
  mode: "project";
  projectId: string;
}

interface NamedModelProps extends BaseProps {
  mode: "named-model";
  namedModelId: string;
}

type Props = ProjectProps | NamedModelProps;

/**
 * Client button that opens the AttachRecipeModal. Lives in its own
 * file so server components can render the modal panel without going
 * client themselves.
 */
export function AttachRecipeTrigger(props: Props) {
  const { label = "[ + ] Attach recipe", variant = "primary" } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "inline-flex items-center gap-2 px-3 py-1.5 tap-target text-xs font-mono",
          variant === "primary"
            ? "frame-strong hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]"
            : "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] normal-case tracking-normal",
        )}
      >
        {label}
      </button>
      {props.mode === "project" ? (
        <AttachRecipeModal
          mode="project"
          projectId={props.projectId}
          open={open}
          onClose={() => setOpen(false)}
          candidates={props.candidates}
        />
      ) : (
        <AttachRecipeModal
          mode="named-model"
          namedModelId={props.namedModelId}
          open={open}
          onClose={() => setOpen(false)}
          candidates={props.candidates}
        />
      )}
    </>
  );
}

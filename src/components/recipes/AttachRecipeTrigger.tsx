"use client";

import { useState } from "react";
import {
  AttachRecipeModal,
  type RecipeOption,
} from "@/components/recipes/AttachRecipeModal";
import { Button } from "@/components/ui/Button";

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
  // R7-006 — ATTACH RECIPE flipped from primary (cyan) to success
  // (green) per the post-Round-7 rule: cyan-on-buttons is reserved for
  // auth/sign-in/confirm. ATTACH is a create-link action → green. The
  // "primary" prop alias stays for back-compat with callers that pass
  // it explicitly; it now resolves to success.
  const { label = "Attach recipe", variant = "primary" } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant={variant === "primary" ? "success" : "ghost"}
        size="sm"
      >
        {label}
      </Button>
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

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
  const { label = "Attach recipe", variant = "primary" } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant={variant === "primary" ? "primary" : "ghost"}
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

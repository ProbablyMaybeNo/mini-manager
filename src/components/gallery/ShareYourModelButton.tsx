"use client";

import { useState } from "react";
import { Button } from "@/components/kit";
import { ShareCardComposer } from "@/components/recipe/ShareCardComposer";

/**
 * Gallery "Share your model" entry point. Opens the composer straight into
 * compose mode — no picker in front of it.
 *
 * It used to list the painter's recipes and make them choose one before
 * anything else happened, which meant a model could only be posted if a
 * recipe for it already existed. That is backwards for a gallery whose whole
 * job is showing painted models: the recipe is a detail of the post, not its
 * prerequisite. Now the composer opens empty, a project dropdown inside it
 * fills the title / paints / photo for painters who have one, and a painter
 * with neither can still type a title and post a photograph.
 */
export function ShareYourModelButton({
  variant = "primary",
  label = "Share your model",
}: {
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <ShareCardComposer
        composable
        open={open}
        onClose={() => setOpen(false)}
        recipeName={null}
        slots={[]}
        initialNotes={null}
      />
    </>
  );
}

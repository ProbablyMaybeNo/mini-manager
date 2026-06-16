import type { ButtonHTMLAttributes } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./Button";

/**
 * Square icon button — shares the {@link Button} variant set so it inherits the
 * full palette and the MM-52 "+" rule. For an add/＋ icon button use
 * `variant="add"` (neon green) — or `variant="addWishlist"` (yellow) for the
 * wishlist. An `aria-label` is required for icon-only buttons.
 */
export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  "aria-label": string;
}

const sizePad: Record<NonNullable<VariantProps<typeof buttonVariants>["size"]>, string> = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-11 w-11 text-lg",
};

export function IconButton({ className, variant, size = "md", ...props }: IconButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        // override the rectangular padding with a fixed square footprint
        "!px-0 !py-0",
        sizePad[size ?? "md"],
        className,
      )}
      {...props}
    />
  );
}

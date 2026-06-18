import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared button primitive — implements the design-language button tiers
 * (DESIGN_LANGUAGE.md §4): 1px phosphor border, solid OR outline, black text on
 * solid fills, no gradients/pills.
 *
 * Palette adoption: beyond the cyan-default tiers, every palette accent has a
 * solid + outline variant so page agents get the full 5-colour palette for free
 * (`variant="solidGreen"`, `variant="outlineYellow"`, …).
 *
 * "+" rule (thread JlrBYUITMqoa / MM-52): use `variant="add"` for any add/＋
 * button — it is neon green by default. The single exception is wishlist add
 * buttons, which use `variant="addWishlist"` (yellow).
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 font-body2 uppercase tracking-[0.15em] transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 disabled:opacity-40 disabled:pointer-events-none motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]",
  {
    variants: {
      variant: {
        /* ---- Tiers (cyan-led, per the button sheet) ---- */
        primary:
          "border border-cyan bg-cyan/15 text-cyan hover:bg-cyan/25 glow-cyan hover:shadow-[0_0_6px_rgba(0,210,255,0.45),0_0_1px_rgba(0,210,255,0.8),0_8px_18px_-6px_rgba(0,210,255,0.5)]",
        secondary:
          "border border-cyan/60 bg-transparent text-cyan hover:bg-cyan/10 hover:border-cyan hover:shadow-[0_6px_16px_-8px_rgba(0,210,255,0.45)]",
        tertiary:
          "border-0 bg-transparent text-fg-dim underline-offset-4 hover:text-cyan hover:underline",
        danger:
          "border border-red bg-red/10 text-red hover:bg-red/20 hover:shadow-[0_6px_16px_-8px_rgba(255,66,66,0.45)]",

        /* ---- "+" / add buttons (MM-52) ----
           Default add = neon green; wishlist add = yellow. */
        add:
          "border border-green bg-green text-bg hover:bg-green/85 glow-green hover:shadow-[0_0_6px_rgba(81,253,128,0.45),0_8px_18px_-6px_rgba(81,253,128,0.5)]",
        addWishlist:
          "border border-yellow bg-yellow text-bg hover:bg-yellow/85 glow-yellow hover:shadow-[0_0_6px_rgba(238,249,150,0.45),0_8px_18px_-6px_rgba(238,249,150,0.5)]",

        /* ---- Solid fills (colour fill + black text) ---- */
        solidCyan: "border border-cyan bg-cyan text-bg hover:bg-cyan/85 glow-cyan",
        solidGreen: "border border-green bg-green text-bg hover:bg-green/85 glow-green",
        solidYellow: "border border-yellow bg-yellow text-bg hover:bg-yellow/85 glow-yellow",
        solidPurple: "border border-purple bg-purple text-bg hover:bg-purple/85 glow-purple",
        solidRed: "border border-red bg-red text-bg hover:bg-red/85 glow-red",

        /* ---- Outlines (colour border + black fill + colour text) ---- */
        outlineCyan: "border border-cyan/60 bg-transparent text-cyan hover:bg-cyan/10 hover:border-cyan",
        outlineGreen: "border border-green/60 bg-transparent text-green hover:bg-green/10 hover:border-green",
        outlineYellow: "border border-yellow/60 bg-transparent text-yellow hover:bg-yellow/10 hover:border-yellow",
        outlinePurple: "border border-purple/60 bg-transparent text-purple hover:bg-purple/10 hover:border-purple",
        outlineRed: "border border-red/60 bg-transparent text-red hover:bg-red/10 hover:border-red",
      },
      size: {
        sm: "px-3 py-1 text-[10px]",
        md: "px-4 py-2 text-xs",
        lg: "px-6 py-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonVariants };

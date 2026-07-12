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
 * "+" rule (colour contract §4): use `variant="add"` for any add/＋ button — it
 * renders as the blue primary. `variant="attach"` renders as the neutral
 * secondary outline. The single coloured exception is wishlist add buttons,
 * which use `variant="addWishlist"` (yellow).
 */
/**
 * V2 "HEX.CODE" buttons (style guide 1:66). Primary = solid cyan fill + dark
 * text @ 6px radius; outline = transparent + white-12% border; colour variants
 * are solid fills (success/danger/warning) or coloured outlines. Bold JetBrains
 * Mono, 6px radius, no glow. APIs (variant/size names) are unchanged so callers
 * keeps working — the cyan-led `primary` is now a true filled button.
 */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-[6px] font-display font-bold uppercase text-button tracking-tight transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 disabled:border-border disabled:bg-transparent disabled:text-fg-muted disabled:pointer-events-none motion-safe:active:scale-[0.98]",
  {
    variants: {
      variant: {
        /* ---- Tiers (cyan-led primary, per the buttons sheet) ---- */
        primary:
          "border border-cyan bg-cyan text-bg hover:bg-cyan/85",
        secondary:
          "border border-border bg-transparent text-fg hover:bg-fg/5 hover:border-fg/25",
        tertiary:
          "border-0 bg-transparent text-fg-dim underline-offset-4 hover:text-cyan-lite hover:underline",
        danger:
          "border border-red bg-red text-white hover:bg-red/85",

        /* ---- "+" / add buttons ----
           Colour contract §4: the "+" glyph + label already say "add", so the
           coloured "+" is retired. `add` now renders as the blue primary and
           `attach` as the neutral secondary outline (variant names kept to avoid
           a churny call-site rename). Wishlist add keeps yellow (real semantic). */
        add:
          "border border-cyan bg-cyan text-bg hover:bg-cyan/85",
        addWishlist:
          "border border-yellow bg-yellow text-bg hover:bg-yellow/85",
        attach:
          "border border-border bg-transparent text-fg hover:bg-fg/5 hover:border-fg/25",

        /* ---- Solid fills (colour fill + dark text) ---- */
        solidCyan: "border border-cyan bg-cyan text-bg hover:bg-cyan/85",
        solidGreen: "border border-green bg-green text-bg hover:bg-green/85",
        solidYellow: "border border-yellow bg-yellow text-bg hover:bg-yellow/85",
        solidPurple: "border border-purple bg-purple text-bg hover:bg-purple/85",
        solidRed: "border border-red bg-red text-white hover:bg-red/85",

        /* ---- Outlines (colour border + transparent fill + colour text) ---- */
        outlineCyan: "border border-cyan/60 bg-transparent text-cyan-lite hover:bg-cyan/10 hover:border-cyan",
        outlineGreen: "border border-green/60 bg-transparent text-green hover:bg-green/10 hover:border-green",
        outlineYellow: "border border-yellow/60 bg-transparent text-yellow hover:bg-yellow/10 hover:border-yellow",
        outlinePurple: "border border-purple/60 bg-transparent text-purple hover:bg-purple/10 hover:border-purple",
        outlineRed: "border border-red/60 bg-transparent text-red hover:bg-red/10 hover:border-red",
      },
      size: {
        // Font size is the shared --text-button token (base class); size
        // variants only change padding so all buttons share one font size.
        sm: "px-2.5 py-1.5",
        md: "px-4 py-2.5",
        lg: "px-6 py-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /**
   * Opt out of the app-wide ALL-CAPS button casing. Use only when the label
   * echoes user data or a value (recipe / paint names, hex codes) where forcing
   * uppercase would misrepresent it. `text-transform` doesn't change the DOM
   * text or accessible name, so this is purely visual.
   */
  normalCase?: boolean;
}

export function Button({ className, variant, size, normalCase, ...props }: ButtonProps) {
  return (
    <button
      className={cn(button({ variant, size }), normalCase && "normal-case", className)}
      {...props}
    />
  );
}

export { button as buttonVariants };

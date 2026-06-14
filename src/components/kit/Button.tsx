import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-osd uppercase tracking-[0.15em] transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out focus-visible:outline-2 disabled:opacity-40 disabled:pointer-events-none motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "border border-cyan bg-cyan/15 text-cyan hover:bg-cyan/25 glow-cyan hover:shadow-[0_0_6px_rgba(0,210,255,0.45),0_0_1px_rgba(0,210,255,0.8),0_8px_18px_-6px_rgba(0,210,255,0.5)]",
        secondary:
          "border border-cyan/60 bg-transparent text-cyan hover:bg-cyan/10 hover:border-cyan hover:shadow-[0_6px_16px_-8px_rgba(0,210,255,0.45)]",
        tertiary: "border-0 bg-transparent text-fg-dim underline-offset-4 hover:text-cyan hover:underline",
        danger:
          "border border-red bg-red/10 text-red hover:bg-red/20 hover:shadow-[0_6px_16px_-8px_rgba(255,66,66,0.45)]",
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

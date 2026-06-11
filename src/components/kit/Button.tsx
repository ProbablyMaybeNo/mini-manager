import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-osd uppercase tracking-[0.15em] transition-colors focus-visible:outline-2 disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "border border-cyan bg-cyan/15 text-cyan hover:bg-cyan/25 glow-cyan",
        secondary: "border border-cyan/60 bg-transparent text-cyan hover:bg-cyan/10",
        tertiary: "border-0 bg-transparent text-fg-dim underline-offset-4 hover:text-cyan hover:underline",
        danger: "border border-red bg-red/10 text-red hover:bg-red/20",
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

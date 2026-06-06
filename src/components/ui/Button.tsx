import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { clsx } from "clsx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "purple";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonTone = "solid" | "outline";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  success: "btn-success",
  warning: "btn-warning",
  purple: "btn-purple",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visual tone. `solid` (default) renders the variant as a filled
   *  block of colour with black text — the canonical P13.1 button.
   *  `outline` flips back to transparent bg + coloured text + coloured
   *  border for low-emphasis surfaces (e.g. dense inline actions). */
  tone?: ButtonTone;
  children: ReactNode;
  className?: string;
}

type ButtonElProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    as?: "button";
  };

type AnchorElProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    as: "a";
    href: string;
  };

export type ButtonProps = ButtonElProps | AnchorElProps;

/** Button primitive — semantic variants for the locked five-colour palette.
 *
 *  Phase 12 (P12.23) locked the intent → colour map. Phase 13 (P13.1)
 *  killed the bracketed-outline aesthetic — every button now ships
 *  filled-solid by default with high-contrast black text per WCAG AA.
 *
 *    primary  — solid cyan + black text. The lead action: save / confirm
 *               / sign-in / navigate. Cyan-on-primary is the locked
 *               Phase-0 design (DESIGN_LANGUAGE §2) — the prior "no cyan
 *               on CTAs" guardrail is retired.
 *    secondary— solid green + black text. The supporting action, kept
 *               visually distinct from the cyan primary so a pair reads
 *               as a hierarchy.
 *    ghost    — near-black fill + neutral border + white text. Tertiary /
 *               dismiss / cancel; minimal, icon-first, compact.
 *    danger   — solid red + black text. Remove / delete / destroy.
 *    success  — solid neon-green + black text. ADD / CREATE / NEW /
 *               SAVE-NEW. The default "I'm making something" button.
 *    warning  — solid pastel-yellow + black text. SHARE / IMPORT /
 *               EXPORT / ADD-TO-WISHLIST. The "lateral move" CTA.
 *    purple   — solid pastel-purple + black text. SPECIAL / FEATURED /
 *               FOUNDER / PRO-TIER affordances.
 *
 *  Sizes: sm / md / lg. Pass `as="a"` to render as an anchor.
 *  Pass `tone="outline"` to drop back to the transparent-bordered
 *  rendering for low-emphasis surfaces — solid stays the default. */
export function Button(props: ButtonProps) {
  const variant: ButtonVariant = props.variant ?? "secondary";
  const size: ButtonSize = props.size ?? "md";
  const tone: ButtonTone = props.tone ?? "solid";
  const cls = clsx(
    "btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    tone === "outline" && "btn-outline",
    props.className,
  );

  if (props.as === "a") {
    const {
      as: _as,
      variant: _v,
      size: _s,
      tone: _t,
      className: _c,
      children,
      ...rest
    } = props;
    void _as;
    void _v;
    void _s;
    void _t;
    void _c;
    return (
      <a className={cls} {...rest}>
        {children}
      </a>
    );
  }
  const {
    as: _as,
    variant: _v,
    size: _s,
    tone: _t,
    className: _c,
    children,
    ...rest
  } = props;
  void _as;
  void _v;
  void _s;
  void _t;
  void _c;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

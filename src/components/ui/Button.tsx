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
  | "destructive"
  | "success"
  | "tertiary"
  | "warning"
  | "purple";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonTone = "solid" | "outline";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  destructive: "btn-danger",
  success: "btn-success",
  tertiary: "btn-success",
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
  /** Visual tone (gold-standard §03). `outline` (the DEFAULT for the
   *  coloured intent variants) renders a transparent chip with a coloured
   *  1px border + matching coloured text + phosphor glow — the canonical
   *  look in the spec image. `solid` is the escape hatch that refills the
   *  variant with its hue + black text for the rare hard-commit surfaces
   *  (delete-confirm, active segmented row). `primary` is always a solid
   *  cyan block regardless of tone; `ghost` keeps its near-black fill. */
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

/** Button primitive — semantic variants for the locked palette.
 *
 *  FIGMA-REBUILD (REBUILD_SPEC §1) — the Style Guide button tiers map onto
 *  these variants. Every tier ships SOLID (colour fill + black text, via
 *  `tone="solid"`) or OUTLINE (1px coloured border + coloured text, the
 *  default tone). Sharp corners, 1px border, phosphor glow.
 *
 *    SPEC TIER       → variant
 *    Primary (cyan)  → "primary"   (solid cyan + black text by default;
 *                       tone="outline" for the cyan-outline form)
 *    Secondary (yel) → "warning"   (yellow outline; tone="solid" to fill)
 *    Tertiary (grn)  → "tertiary"  (green outline, icon-first/compact;
 *                       alias of "success" — same class)
 *    Destructive(red)→ "destructive" (red outline; alias of "danger")
 *
 *    primary  — solid cyan + black text. The one lead action: save /
 *               confirm / ADD PROJECT / navigate.
 *    secondary— white border + white text, no fill. Neutral supporting
 *               action so the cyan primary owns the hierarchy.
 *    ghost    — near-black fill + neutral border + white text. Dismiss /
 *               cancel / dense inline actions.
 *    danger | destructive — red outline. REMOVE / DELETE / CLEAR FILTER.
 *    success | tertiary   — green outline. ADD / CREATE / UPLOAD.
 *    warning  — pastel-yellow outline. SHARE / IMPORT / + WISHLIST.
 *    purple   — pastel-purple outline. SPECIAL / FEATURED / ASSIGN.
 *
 *  Sizes: sm / md / lg. Pass `as="a"` to render as an anchor.
 *  Pass `tone="solid"` to refill a coloured variant with its hue + black
 *  text — outline stays the default for non-primary variants. */
export function Button(props: ButtonProps) {
  const variant: ButtonVariant = props.variant ?? "secondary";
  const size: ButtonSize = props.size ?? "md";
  const tone: ButtonTone = props.tone ?? "outline";
  const cls = clsx(
    "btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    tone === "outline" && "btn-outline",
    tone === "solid" && "btn-solid",
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

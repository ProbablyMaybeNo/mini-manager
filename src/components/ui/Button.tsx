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
 *  GOLD-STANDARD (2026-06) reversed the P13.1 all-solid rule. The spec
 *  image (docs/design/gold-standard-ui.png §03) is the literal contract:
 *  PRIMARY is the lone solid-filled lead action; every coloured intent
 *  variant ships as a phosphor OUTLINE (transparent fill + coloured 1px
 *  border + matching coloured text + glow). `tone="solid"` is the escape
 *  hatch that refills a coloured variant for hard-commit surfaces.
 *
 *    primary  — solid cyan + black text. The one lead action: save /
 *               confirm / sign-in / navigate.
 *    secondary— white border + white text, no fill. Supporting action,
 *               neutral so the cyan primary owns the hierarchy.
 *    ghost    — near-black fill + neutral border + white text. Tertiary /
 *               dismiss / cancel; minimal, icon-first, compact.
 *    danger   — red outline. Remove / delete / destroy.
 *    success  — green outline. ADD / CREATE / NEW / SAVE-NEW.
 *    warning  — pastel-yellow outline. SHARE / IMPORT / EXPORT / WISHLIST.
 *    purple   — pastel-purple outline. SPECIAL / FEATURED / FOUNDER.
 *
 *  Sizes: sm / md / lg. Pass `as="a"` to render as an anchor.
 *  Pass `tone="solid"` to refill a coloured variant with its hue + black
 *  text for the rare high-emphasis surfaces — outline stays the default. */
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

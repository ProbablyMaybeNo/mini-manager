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

/** Button primitive — semantic variants for the four-colour palette
 *  Ross locked in Phase 12:
 *
 *    primary  — cyan filled. RESERVED for save / confirm / sign-in.
 *               NOT for ADD/CREATE/NEW (those go to `success`).
 *    secondary— cyan outline. Navigation, secondary cta.
 *    ghost    — transparent, hover-accent. Tertiary.
 *    danger   — pastel-red outline. Remove / cancel / delete / destroy.
 *    success  — neon-green filled (dark text). ADD / CREATE / NEW /
 *               SAVE-NEW. The default "I'm making something" button.
 *    warning  — pastel-yellow filled (dark text). SHARE / IMPORT /
 *               EXPORT / ADD-TO-WISHLIST. The "lateral move" CTA.
 *    purple   — pastel-purple outline. SPECIAL / FEATURED / FOUNDER /
 *               PRO-TIER affordances.
 *
 *  Sizes: sm / md / lg. Pass `as="a"` to render as an anchor.
 *  See P12.23 for the full discipline + P12.24 for the app-wide sweep. */
export function Button(props: ButtonProps) {
  const variant: ButtonVariant = props.variant ?? "secondary";
  const size: ButtonSize = props.size ?? "md";
  const cls = clsx(
    "btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    props.className,
  );

  if (props.as === "a") {
    const { as: _as, variant: _v, size: _s, className: _c, children, ...rest } = props;
    void _as;
    void _v;
    void _s;
    void _c;
    return (
      <a className={cls} {...rest}>
        {children}
      </a>
    );
  }
  const { as: _as, variant: _v, size: _s, className: _c, children, ...rest } = props;
  void _as;
  void _v;
  void _s;
  void _c;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

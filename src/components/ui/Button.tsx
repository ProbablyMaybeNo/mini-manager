import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
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

/** Button primitive — variants: primary (filled cyan) / secondary (outlined
 *  cyan) / ghost (transparent, hover-accent) / danger (outlined red).
 *  Sizes: sm / md / lg. Pass `as="a"` to render as an anchor. */
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

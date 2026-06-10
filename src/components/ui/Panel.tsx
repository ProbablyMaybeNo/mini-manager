import type { ComponentType, ElementType, ReactNode } from "react";
import { clsx } from "clsx";
import {
  Info,
  TriangleAlert,
  CircleCheck,
  CircleX,
  type LucideProps,
} from "lucide-react";

/** Semantic panel surface — gold-standard §07 + FIGMA-REBUILD accents.
 *  default  white border, white title, white body (the bare frame).
 *  info     cyan border + ⓘ icon + cyan title.
 *  warning  yellow border + ⚠ icon + yellow title.
 *  success  green border + ✓ icon + green title.
 *  error    red border + ✕ icon + red title.
 *  disabled dim border + dim title + dim body, no icon.
 *
 *  ACCENT aliases (FIGMA-REBUILD, REBUILD_SPEC §1) — page agents tone a
 *  panel by colour without semantic baggage (no icon rendered):
 *  cyan / green / yellow / red / purple. Border, corner ticks, tech label
 *  and edge glow all follow the hue via currentColor. */
export type PanelVariant =
  | "default"
  | "info"
  | "warning"
  | "success"
  | "error"
  | "disabled"
  | "cyan"
  | "green"
  | "yellow"
  | "red"
  | "purple";

const VARIANT_CLASS: Record<PanelVariant, string | false> = {
  default: false,
  info: "panel-info",
  warning: "panel-warning",
  success: "panel-success",
  error: "panel-error",
  disabled: "panel-disabled",
  cyan: "panel-info",
  green: "panel-success",
  yellow: "panel-warning",
  red: "panel-error",
  purple: "panel-purple",
};

/** Icon per variant — null for default, disabled, and the plain colour
 *  accents (only the semantic variants carry a glyph). */
const VARIANT_ICON: Record<PanelVariant, ComponentType<LucideProps> | null> = {
  default: null,
  info: Info,
  warning: TriangleAlert,
  success: CircleCheck,
  error: CircleX,
  disabled: null,
  cyan: null,
  green: null,
  yellow: null,
  red: null,
  purple: null,
};

/**
 * Panel — the single, canonical nested-border terminal frame (UX-003).
 *
 * The codebase already pins panel backgrounds to a near-black token
 * (`--color-bg-elevated` = #0A0A0A) so there are no grey fills left; the
 * remaining drift risk is panels being HAND-BUILT from the raw
 * `className="panel"` + a manually-placed `<span className="panel-label">`,
 * which is easy to get wrong (forgotten ticks, label markup duplicated per
 * call site). This component makes the `.panel` / `.panel-ticks` /
 * `.panel-label` / `.panel-transparent` / `.panel-nested` CSS primitives
 * the ONLY supported way to build a bare terminal panel, so the black-fill
 * + phosphor-border + corner-ticks language can't silently regress to a
 * grey SaaS box on any new surface.
 *
 * `.panel` is the bare frame (compose freely — it imposes no header/body
 * split; for the header/body card use `Card`). Toggle the bezel detail via
 * props:
 *   - `ticks`       L-shaped corner brackets (registration marks).
 *   - `label`       tiny mono caption notched onto the top border.
 *   - `nested`      a second inner ring 4px in (the box-in-box CRT bezel).
 *   - `transparent` drop the #0A0A0A fill so the panel floats on whatever
 *                   sits behind it (still bordered, still never grey).
 *
 * Defaults to a `<div>`; pass `as` for a semantic element (e.g. `"section"`).
 */
export interface PanelProps {
  children: ReactNode;
  /** Draw L-shaped corner ticks/brackets. */
  ticks?: boolean;
  /** Draw the inner nested-border ring (box-in-box bezel). */
  nested?: boolean;
  /** Drop the near-black fill — pure box-on-black. */
  transparent?: boolean;
  /** Tiny technical caption slotted onto the top border (e.g. `DB ▸ RANKED`).
   *  Rendered aria-hidden — it's chrome flavour, not content. */
  label?: string;
  /** Semantic surface (gold-standard §07): default / info / warning /
   *  success / error / disabled. Colours the border + edge glow in-hue. */
  variant?: PanelVariant;
  /** Optional coloured title rendered with the variant's icon (the image's
   *  "⚠ WARNING PANEL" lockup). When set, the children render under it as
   *  the panel body. Omit to compose the panel freely. */
  title?: string;
  /** Heading level for `title`. Defaults to a non-heading <p> so the panel
   *  doesn't pollute the document outline; pass e.g. "h3" when the panel
   *  IS a section heading. */
  titleAs?: "p" | "h2" | "h3" | "h4";
  /** Element to render. Defaults to `div`. */
  as?: ElementType;
  className?: string;
  /** Forwarded to the root element (role, aria-*, etc.). */
  [key: string]: unknown;
}

export function Panel({
  children,
  ticks = false,
  nested = false,
  transparent = false,
  label,
  variant = "default",
  title,
  titleAs = "p",
  as,
  className,
  ...rest
}: PanelProps) {
  const Tag = (as ?? "div") as ElementType;
  const Icon = VARIANT_ICON[variant];
  const TitleTag = titleAs as ElementType;
  return (
    <Tag
      className={clsx(
        "panel",
        VARIANT_CLASS[variant],
        transparent && "panel-transparent",
        nested && "panel-nested",
        (ticks || label) && "relative",
        ticks && "panel-ticks",
        className,
      )}
      {...rest}
    >
      {label ? (
        <span className="panel-label" aria-hidden>
          {label}
        </span>
      ) : null}
      {title ? (
        <TitleTag className="panel-variant-head">
          {Icon ? (
            <span className="panel-variant-icon" aria-hidden>
              <Icon size={16} strokeWidth={2} />
            </span>
          ) : null}
          {title}
        </TitleTag>
      ) : null}
      {title ? <div className="panel-variant-body">{children}</div> : children}
    </Tag>
  );
}

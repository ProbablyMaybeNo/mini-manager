import type { ElementType, ReactNode } from "react";
import { clsx } from "clsx";

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
  as,
  className,
  ...rest
}: PanelProps) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={clsx(
        "panel",
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
      {children}
    </Tag>
  );
}

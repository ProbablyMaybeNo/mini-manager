import { GradientClient } from "./GradientClient";
import { GlazeClient } from "./GlazeClient";

/**
 * The Layering tool, stacked:
 *  - Value ramp: shadow → base → highlight opaque stacking (GradientClient).
 *  - Glaze / undercoat: pick a transparent top paint + a goal, get the
 *    undercoat to lay beneath it, previewed as an optical-mix Venn
 *    (GlazeClient).
 * Both sit on the same page — the glaze planner reads directly underneath
 * the ramp rather than behind a mode toggle.
 */
export function LayeringClient() {
  return (
    <div className="space-y-8">
      <GradientClient />
      <div className="scan-divider" />
      <GlazeClient />
    </div>
  );
}

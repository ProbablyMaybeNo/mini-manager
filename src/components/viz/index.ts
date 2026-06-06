/**
 * viz kit barrel (DESIGN_LANGUAGE §13) — bespoke, SSR-safe SVG data-viz
 * styled to the Figma moodboard. Token colours only, glow on active
 * arcs/lines only, motion-safe mount animation, readability as the floor.
 *
 * Reuse: these supersede generic widgets across the app. RadialGauge
 * supersedes the plain CircularProgress on new dashboards (the old one is
 * kept for now). Focus / Project pages should reach for these next.
 */
export { RadialGauge, type RadialGaugeProps } from "./RadialGauge";
export { LineGraph, AreaGraph, type LineGraphProps } from "./LineGraph";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { SegmentedBar, type SegmentedBarProps } from "./SegmentedBar";
export { WireframeGlobe, type WireframeGlobeProps } from "./WireframeGlobe";
export {
  type VizTone,
  type VizToneOrAuto,
  VIZ_STROKE,
  resolveAutoTone,
} from "./vizTokens";

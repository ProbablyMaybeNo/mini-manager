import { hslToHex } from "@/lib/color";
import type {
  ActivityEntry,
  CalendarEvent,
  CollectionItem,
  MatchResult,
  Paint,
  PricingTier,
  Project,
  Recipe,
  SessionStats,
} from "@/lib/types";

/* ----------------------------------------------------------------------------
 * Populated fixtures — mirror the Figma mockups so every screen renders real-looking.
 * ------------------------------------------------------------------------- */

export const mockProjects: Project[] = [
  { id: "p1", title: "Space Marines", type: "Army", recipeSwatches: ["#3a6ea5", "#1c2e44", "#c7c7c7", "#d4a017"], status: "PAINTING", priority: "High", completionPercent: 45 },
  { id: "p2", title: "Ork Boyz", type: "Unit", recipeSwatches: ["#4a7c30", "#2e4d1f", "#8b5a2b"], status: "BUILDING", priority: "Med", completionPercent: 20 },
  { id: "p3", title: "Maggotkin", type: "Army", recipeSwatches: ["#6b7d3a", "#aab85a", "#5a3d2b", "#c4424a"], status: "BASING", priority: "High", completionPercent: 78 },
  { id: "p4", title: "Skaven Clanrats", type: "Warband", recipeSwatches: ["#7a5230", "#3a2a1a"], status: "PRIMING", priority: "Low", completionPercent: 12 },
  { id: "p5", title: "Eldar Aspect", type: "Unit", recipeSwatches: ["#1f6f6f", "#0d3b3b", "#e0c050", "#ffffff"], status: "COMPLETE", priority: "Med", completionPercent: 100 },
  { id: "p6", title: "Chaos Tank", type: "Model", recipeSwatches: ["#7a1f1f", "#2a2a2a", "#b5b5b5"], status: "OWNED", priority: "Low", completionPercent: 0 },
  { id: "p7", title: "Ruined Hab-Block", type: "Terrain", recipeSwatches: ["#5a5a5a", "#3a3a3a", "#6b4a2b"], status: "WISHLIST", priority: "Low", completionPercent: 0 },
];

export const mockSessionStats: SessionStats = {
  todayMinutes: 83,
  weekMinutes: 347,
  allTimeMinutes: 347 * 12,
  streakDays: 3,
};

export const mockActivity: ActivityEntry[] = [
  { id: "a1", icon: "add", text: "Added Ork Boys", when: "2h ago" },
  { id: "a2", icon: "cart", text: "Bought Space Marines", when: "5h ago" },
  { id: "a3", icon: "build", text: "Built Skaven", when: "1d ago" },
  { id: "a4", icon: "prime", text: "Primed Skaven", when: "1d ago" },
  { id: "a5", icon: "paint", text: "Painted Mutant", when: "2d ago" },
  { id: "a6", icon: "check", text: "Completed Eldar", when: "3d ago" },
  { id: "a7", icon: "build", text: "Built Ork Boys", when: "4d ago" },
  { id: "a8", icon: "paint", text: "Painted Chaos Tank", when: "5d ago" },
];

export const mockEvents: CalendarEvent[] = [
  { id: "e1", date: "2026-09-08", name: "MAGGOTKIN 2k", kind: "tournament" },
  { id: "e2", date: "2026-06-21", name: "Club battle night", kind: "battle" },
  { id: "e3", date: "2026-07-02", name: "Golden Demon entry due", kind: "deadline" },
];

export const mockPaints: Paint[] = [
  { id: "pt1", name: "Burnt Red", brand: "AK Interactive", line: "3rd Gen", hex: "#592110", type: "Acrylic", sku: "AK11086", owned: true, wishlisted: false },
  { id: "pt2", name: "Macragge Blue", brand: "Citadel", line: "Base", hex: "#0d407f", type: "Acrylic", sku: "21-08", owned: true, wishlisted: false },
  { id: "pt3", name: "Nuln Oil", brand: "Citadel", line: "Shade", hex: "#14181a", type: "Wash", sku: "24-14", owned: true, wishlisted: false },
  { id: "pt4", name: "Plaguebearer Flesh", brand: "Citadel", line: "Contrast", hex: "#8a9a4a", type: "Contrast", sku: "29-44", owned: false, wishlisted: true },
  { id: "pt5", name: "Speed Green", brand: "Army Painter", line: "Speedpaint", hex: "#3f8a3a", type: "Contrast", sku: "WP2014", owned: true, wishlisted: false },
  { id: "pt6", name: "Matt White Primer", brand: "Army Painter", line: "Colour Primer", hex: "#f2f2f2", type: "Primer", sku: "CP3001", owned: false, wishlisted: false },
  { id: "pt7", name: "Soft Tone", brand: "Army Painter", line: "Warpaints", hex: "#6b5230", type: "Wash", sku: "WP1136", owned: true, wishlisted: false },
  { id: "pt8", name: "Crystal Clear", brand: "Vallejo", line: "Auxiliary", hex: "#e8f4f8", type: "Clear", sku: "70.510", owned: false, wishlisted: true },
];

export const mockMatchResults: MatchResult[] = [
  { paint: mockPaints[1], distanceScore: 1.2 },
  { paint: mockPaints[4], distanceScore: 3.8 },
  { paint: mockPaints[0], distanceScore: 6.1 },
];

/* ----------------------------------------------------------------------------
 * Generated wall of paints — deterministic (no Date/random) so SSR/client agree.
 * Stands in for the host's full 7,144-paint catalog; here we render ~140 tiles.
 * ------------------------------------------------------------------------- */
const WALL_BRANDS = ["Citadel", "Vallejo", "Army Painter", "AK Interactive", "P3", "Scale75"];
const WALL_LINES = ["Base", "Layer", "Contrast", "Air", "Metallic", "Wash"];
const WALL_TYPES: Paint["type"][] = ["Acrylic", "Contrast", "Wash", "Glaze", "Primer"];

export const generatedPaints: Paint[] = Array.from({ length: 140 }, (_, i) => {
  const hue = (i * 137.50776) % 360; // golden-angle spread for an even wall
  const sat = 45 + ((i * 7) % 45);
  const light = 38 + ((i * 11) % 34);
  const brand = WALL_BRANDS[i % WALL_BRANDS.length];
  const line = WALL_LINES[i % WALL_LINES.length];
  const type = WALL_TYPES[i % WALL_TYPES.length];
  return {
    id: `gp${i}`,
    name: `${line} ${Math.round(hue)}`,
    brand,
    line,
    hex: hslToHex(hue, sat, light),
    type,
    sku: `${brand.slice(0, 2).toUpperCase()}${1000 + i}`,
    owned: i % 3 === 0,
    wishlisted: i % 7 === 0,
  };
});

/** Full library set: the named, detailed paints first, then the generated wall. */
export const mockLibrary: Paint[] = [...mockPaints, ...generatedPaints];

export const mockRecipes: Recipe[] = [
  {
    id: "r1",
    name: "Ultramarines Battle-Ready",
    assignedProjectId: "p1",
    shareUrl: "https://mini.mgr/r/abc",
    notes:
      "Airbrush blue base, mix 50/50 thinner and paint.\nDry brush green over the model — keep the bristles very slightly moist.\nNuln Oil into recesses only, then edge-highlight panels.",
    inspoLinks: ["https://example.com/ultra-1.jpg"],
    slots: [
      { paintId: "pt6", swatch: "#f2f2f2", brand: "Army Painter", name: "Matt White Primer", layer: "Undercoat", note: "Thin coats from 45°." },
      { paintId: "pt2", swatch: "#0d407f", brand: "Citadel", name: "Macragge Blue", layer: "Base", note: "Airbrush 50/50 thinner." },
      { paintId: "pt3", swatch: "#14181a", brand: "Citadel", name: "Nuln Oil", layer: "Shade", note: "Recess only." },
    ],
  },
  {
    id: "r2",
    name: "Speedy Ork Skin",
    inspoLinks: [],
    slots: [
      { paintId: "pt5", swatch: "#3f8a3a", brand: "Army Painter", name: "Speed Green", layer: "Contrast", note: "One thick coat." },
    ],
  },
];

export const mockCollectionPaints: CollectionItem[] = [
  { id: "c1", kind: "paint", thumbnail: "", name: "Red Paint", company: "Army Painter", vendor: "Noble Knight", price: "$1.99", status: "OWNED", sourceUrl: "https://example.com/p1" },
  { id: "c2", kind: "paint", thumbnail: "", name: "Red Paint", company: "Army Painter", vendor: "Noble Knight", price: "$1.99", status: "WISHLIST", sourceUrl: "https://example.com/p2" },
];

export const mockCollectionModels: CollectionItem[] = [
  { id: "m1", kind: "model", thumbnail: "", name: "Primaris Captain", company: "Games Workshop", vendor: "Element Games", price: "$29.99", quantity: 1, status: "OWNED", projectId: "p1", sourceUrl: "https://example.com/m1" },
  { id: "m2", kind: "model", thumbnail: "", name: "Ork Boyz Box", company: "Games Workshop", vendor: "Wayland", price: "$49.99", quantity: 2, status: "BUILDING", projectId: "p2", sourceUrl: "https://example.com/m2" },
];

/* ----------------------------------------------------------------------------
 * Empty fixtures — for empty-state rendering.
 * ------------------------------------------------------------------------- */
export const emptyProjects: Project[] = [];
export const emptyPaints: Paint[] = [];
export const emptyRecipes: Recipe[] = [];
export const emptyActivity: ActivityEntry[] = [];
export const emptyEvents: CalendarEvent[] = [];
export const emptyCollection: CollectionItem[] = [];
export const emptyMatchResults: MatchResult[] = [];
export const zeroSessionStats: SessionStats = { todayMinutes: 0, weekMinutes: 0, allTimeMinutes: 0, streakDays: 0 };

export const mockPricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    features: ["1 army project", "Full paint library", "3 recipes", "Colour match tool"],
    cta: "Start free",
  },
  {
    id: "pro-monthly",
    name: "Pro Monthly",
    price: "$5",
    cadence: "/month",
    features: ["Unlimited projects", "Unlimited recipes", "All four tools", "Recipe sharing", "Collection budgeting"],
    cta: "Go Pro",
  },
  {
    id: "pro-lifetime",
    name: "Pro Lifetime",
    price: "$99",
    cadence: "once",
    features: ["Everything in Pro", "Pay once, keep forever", "All future updates"],
    cta: "Buy lifetime",
  },
  {
    id: "founder",
    name: "Founder",
    price: "$49",
    cadence: "once · limited",
    features: ["Everything in Lifetime", "Founder badge", "Vote on the roadmap", "Direct line to the dev"],
    cta: "Claim Founder seat",
    featured: true,
    seatsLeft: 37,
    seatsTotal: 100,
  },
];

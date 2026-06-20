"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ActivityFeed,
  BootSequence,
  Button,
  Chip,
  IconButton,
  StatusIcon,
  HexField,
  Input,
  MiniCalendar,
  Panel,
  PriorityTag,
  ProgressBar,
  SearchField,
  SegmentedToggle,
  SlideOutPanel,
  StatBox,
  StatusText,
  Swatch,
  SwatchStrip,
  TypeChip,
} from "@/components/kit";
import { mockActivity, mockEvents, mockProjects } from "@/mock/fixtures";
import type { ProjectStatus } from "@/lib/types";

const STATUSES: ProjectStatus[] = [
  "WISHLIST", "OWNED", "BUILDING", "PRIMING", "PAINTING", "BASING", "COMPLETE", "SHELVED",
];

const PAGES: { label: string; path: string; states: { label: string; href: string }[] }[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    states: [
      { label: "Populated", href: "/dashboard" },
      { label: "Empty", href: "/dashboard?state=empty" },
      { label: "Loading", href: "/dashboard?state=loading" },
      { label: "Error", href: "/dashboard?state=error" },
    ],
  },
  {
    label: "Library",
    path: "/library",
    states: [
      { label: "Grid", href: "/library" },
      { label: "Empty", href: "/library?state=empty" },
      { label: "Loading", href: "/library?state=loading" },
      { label: "Error", href: "/library?state=error" },
    ],
  },
  {
    label: "Recipe",
    path: "/recipes",
    states: [
      { label: "Index", href: "/recipes" },
      { label: "Empty", href: "/recipes?state=empty" },
      { label: "Editor", href: "/recipes/r1" },
      { label: "New", href: "/recipes/new" },
    ],
  },
  {
    label: "Tools",
    path: "/tools",
    states: [
      { label: "Hub", href: "/tools" },
      { label: "Wheel", href: "/tools/wheel" },
      { label: "Match", href: "/tools/match" },
      { label: "Dropper", href: "/tools/dropper" },
      { label: "Stacking", href: "/tools/stacking" },
    ],
  },
  {
    label: "Focus",
    path: "/focus",
    states: [
      { label: "Session", href: "/focus" },
      { label: "Empty", href: "/focus?state=empty" },
    ],
  },
  {
    label: "Collection",
    path: "/collection",
    states: [
      { label: "Populated", href: "/collection" },
      { label: "Empty", href: "/collection?state=empty" },
      { label: "Loading", href: "/collection?state=loading" },
      { label: "Error", href: "/collection?state=error" },
    ],
  },
  {
    label: "Public",
    path: "/",
    states: [
      { label: "Landing", href: "/" },
      { label: "Pricing", href: "/pricing" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Sign up", href: "/sign-up" },
      { label: "Reset", href: "/reset" },
    ],
  },
  {
    label: "Account",
    path: "/user",
    states: [
      { label: "Settings", href: "/user" },
      { label: "Account", href: "/user/account" },
    ],
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-osd text-fg">{title}</h2>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </section>
  );
}

export default function GalleryPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-8">
      <header>
        <h1 className="font-title text-title text-cyan text-glow-cyan">KIT GALLERY</h1>
        <p className="mt-2 font-body text-body text-fg">
          Shared presentational kit — every component renders from props, emits via callbacks.
        </p>
      </header>

      <Section title="Pages & states">
        <div className="flex flex-col gap-3">
          {PAGES.map((p) => (
            <div key={p.path} className="flex flex-wrap items-center gap-2">
              <span className="label-osd w-28 text-fg">
                {p.label}
              </span>
              {p.states.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="border border-cyan/50 px-2 py-0.5 font-button text-button uppercase tracking-[0.12em] text-cyan hover:bg-cyan/10"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Palette">
        {["#00d2ff", "#51fd80", "#eef996", "#9b80dc", "#ff4242"].map((h) => (
          <Swatch key={h} hex={h} size="lg" />
        ))}
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-2">
          <span className="font-display text-xl text-cyan">DASHBOARD</span>
          <span className="font-osd text-sm uppercase tracking-[0.2em] text-fg">Heading / OSD Mono</span>
          <span className="font-mono text-sm text-fg-dim">Body — IBM Plex Mono paragraph text.</span>
        </div>
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
        <Button variant="danger">Danger</Button>
      </Section>

      <Section title="Buttons · + rule (MM-52) + palette">
        <Button variant="add">+ Add project</Button>
        <Button variant="addWishlist">+ Add to wishlist</Button>
        <IconButton variant="add" aria-label="Add">+</IconButton>
        <IconButton variant="addWishlist" aria-label="Add to wishlist">+</IconButton>
        <Button variant="solidGreen">Solid green</Button>
        <Button variant="solidYellow">Solid yellow</Button>
        <Button variant="solidPurple">Solid purple</Button>
        <Button variant="outlineYellow">Outline yellow</Button>
        <Button variant="outlinePurple">Outline purple</Button>
      </Section>

      <Section title="Status icons">
        {(["add", "cart", "build", "prime", "paint", "check", "alert"] as const).map((n) => (
          <StatusIcon key={n} name={n} title={n} size={18} />
        ))}
      </Section>

      <Section title="Chips · Status · Priority">
        {(["Army", "Warband", "Unit", "Model", "Terrain"] as const).map((t) => (
          <TypeChip key={t} type={t} />
        ))}
        <Chip accent="purple">Featured</Chip>
      </Section>
      <Section title="Status text">
        {STATUSES.map((s) => (
          <StatusText key={s} status={s} />
        ))}
        <PriorityTag priority="Low" />
        <PriorityTag priority="Med" />
        <PriorityTag priority="High" />
      </Section>

      <Section title="Swatch strip · Progress">
        <SwatchStrip swatches={mockProjects[0].recipeSwatches} />
        <SwatchStrip swatches={[]} onAttach={() => {}} />
        <div className="w-64">
          <ProgressBar percent={45} />
        </div>
        <div className="w-64">
          <ProgressBar percent={100} />
        </div>
      </Section>

      <Section title="Stat boxes">
        <StatBox label="Active projects" value="05" accent="green" />
        <StatBox label="Completion %" value="45%" accent="yellow" />
        <StatBox label="Streak" value="03" accent="purple" />
        <StatBox label="Time Total" value="5:47" accent="cyan" />
      </Section>

      <Section title="Inputs · Toggle">
        <div className="w-56"><Input label="Username" name="u" placeholder="painter_01" /></div>
        <div className="w-56"><Input label="Error" name="e" error="Required field" /></div>
        <div className="w-56"><SearchField name="s" /></div>
        <div className="w-56"><HexField name="h" defaultValue="#00d2ff" label="Hex" /></div>
        <SegmentedToggle
          aria-label="View"
          options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]}
          value={view}
          onChange={setView}
        />
      </Section>

      <Section title="Panels">
        <Panel label="PROJECTS" cornerTicks className="w-72 p-4">
          <p className="font-body text-body text-fg">Cyan-bordered panel with tech label + corner ticks.</p>
        </Panel>
        <Panel label="PLANNER" accent="cyan" className="w-56 p-3">
          <MiniCalendar events={mockEvents} />
        </Panel>
        <Panel label="ACTIVITY" className="w-72 p-4">
          <ActivityFeed entries={mockActivity.slice(0, 5)} />
        </Panel>
      </Section>

      <Section title="Boot sequence · Slide-out">
        <Panel className="w-80 p-4">
          <BootSequence lines={["BOOT /mini-manager", "LOADING paint-db … 7,144", "READY ▸ welcome painter"]} />
        </Panel>
        <Button onClick={() => setOpen(true)}>Open slide-out</Button>
        <SlideOutPanel open={open} onClose={() => setOpen(false)} breadcrumb="LIBRARY ▸ PAINT" title="Macragge Blue">
          <p className="font-body text-body text-fg">The one slide-out language for filter / inspector / detail.</p>
        </SlideOutPanel>
      </Section>
    </main>
  );
}

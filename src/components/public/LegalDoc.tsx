import type { ReactNode } from "react";
import { Panel } from "@/components/kit";
import { PublicHeader } from "./PublicHeader";

/** Shared shell for the Privacy / Terms pages — public, terminal-styled,
 *  centered prose in a panel. Content is passed in as sections. */
export function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-display text-2xl text-cyan text-glow-cyan">{title}</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-faint">
          Last updated {updated}
        </p>
        <Panel cornerTicks className="mt-6 p-6">
          <p className="font-mono text-sm leading-relaxed text-fg-dim">{intro}</p>
          <div className="mt-6 flex flex-col gap-6">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-osd text-xs uppercase tracking-[0.2em] text-cyan">
                  {s.heading}
                </h2>
                <div className="mt-2 font-mono text-sm leading-relaxed text-fg-dim">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </Panel>
        <p className="mt-6 font-mono text-[11px] text-fg-faint">
          This is a starting template — review it with legal counsel before
          relying on it.
        </p>
      </main>
    </div>
  );
}

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
        <h1 className="font-title text-title text-cyan text-glow-cyan">{title}</h1>
        <p className="mt-2 label-osd text-fg">
          Last updated {updated}
        </p>
        <Panel cornerTicks className="mt-6 p-6">
          <p className="font-body text-body leading-relaxed text-fg">{intro}</p>
          <div className="mt-6 flex flex-col gap-6">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-h1 text-h1 uppercase tracking-[0.2em] text-cyan">
                  {s.heading}
                </h2>
                <div className="mt-2 font-body text-body leading-relaxed text-fg">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </Panel>
        <p className="mt-6 font-body text-body text-fg">
          This is a starting template — review it with legal counsel before
          relying on it.
        </p>
      </main>
    </div>
  );
}

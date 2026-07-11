import type { ReactNode } from "react";
import { Panel } from "@/components/kit";
import { PublicHeader } from "./PublicHeader";
import { PublicPageTitle } from "./PublicPageTitle";

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
        <PublicPageTitle align="left">{title}</PublicPageTitle>
        <p className="mt-3 label-osd text-fg-dim">
          Last updated {updated}
        </p>
        <Panel className="mt-6 p-6">
          <p className="font-body text-body leading-relaxed text-fg">{intro}</p>
          <div className="mt-6 flex flex-col gap-6">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-h1 text-h1 uppercase tracking-[0.2em] text-cyan-lite">
                  {s.heading}
                </h2>
                <div className="mt-2 font-body text-body leading-relaxed text-fg">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  );
}

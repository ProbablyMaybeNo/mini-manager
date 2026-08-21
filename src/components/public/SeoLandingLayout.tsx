import type { ReactNode } from "react";
import Link from "next/link";
import { Panel } from "@/components/kit";
import type { FaqEntry } from "@/lib/seo/structuredData";
import { FaqSection } from "./FaqSection";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";
import { PublicPageTitle } from "./PublicPageTitle";
import { SeoCtaRow } from "./SeoCtaRow";

/**
 * Shared shell for the search-intent landing pages, in the same shape as
 * `LegalDoc`: the page file carries nothing but its copy, this carries the
 * chrome — header, the one `<h1>`, `<h2>` sections, CTAs, the visible FAQ that
 * the page's `FAQPage` JSON-LD marks up, and the public footer links.
 *
 * `title` is the `<h1>` and must carry the page's primary search term.
 */
export function SeoLandingLayout({
  title,
  lede,
  ctaLocation,
  sections,
  faq,
  faqHeading,
  related,
  closing,
}: {
  title: string;
  lede: ReactNode;
  /** Names the page in the `CtaStartForFree` funnel event. */
  ctaLocation: string;
  sections: { heading: string; body: ReactNode }[];
  faq: ReadonlyArray<FaqEntry>;
  faqHeading?: string;
  /** Internal links out — the other landing pages, the gallery, pricing. */
  related: { href: string; label: string; blurb: string }[];
  closing: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-12 text-center">
          <PublicPageTitle>{title}</PublicPageTitle>
          <p className="max-w-2xl font-body text-body leading-relaxed text-fg">{lede}</p>
          <SeoCtaRow location={ctaLocation} />
        </section>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-12">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-h1 text-h1 uppercase tracking-[0.2em] text-cyan-lite">
                {s.heading}
              </h2>
              <div className="mt-3 flex flex-col gap-3 font-body text-body leading-relaxed text-fg">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <FaqSection items={faq} heading={faqHeading} />

        <section className="mx-auto w-full max-w-3xl px-6 pb-16">
          <h2 className="mb-4 font-h1 text-h1 uppercase tracking-[0.2em] text-cyan-lite">
            Keep looking around
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="block h-full focus:outline-none">
                  <Panel className="h-full p-4 transition-colors duration-150 ease-out hover:border-cyan/40">
                    <span className="label-osd-h2 text-cyan-lite">{r.label}</span>
                    <span className="mt-1 block font-body text-body leading-relaxed text-fg">
                      {r.blurb}
                    </span>
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col items-center gap-4 px-6 pb-16 text-center">
          <p className="max-w-xl font-body text-body leading-relaxed text-fg">{closing}</p>
          <SeoCtaRow location={`${ctaLocation}-footer`} />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

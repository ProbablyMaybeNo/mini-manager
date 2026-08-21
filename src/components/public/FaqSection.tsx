import { Panel } from "@/components/kit";
import type { FaqEntry } from "@/lib/seo/structuredData";

/**
 * Visible FAQ block for the public marketing surfaces.
 *
 * The page that renders this MUST hand the same array to `faqPageJsonLd()`.
 * Google's structured-data policy requires the marked-up Q&A to be present on
 * the page as content: a `FAQPage` block whose questions appear nowhere in the
 * rendered HTML is ineligible for rich results and is a policy violation. It
 * also wasted the answers, which are the page's densest search-intent copy.
 *
 * Plain heading + paragraph rather than a `<details>` accordion — the answers
 * are short, and always-rendered text needs no expand affordance, no focus
 * handling, and leaves nothing for a crawler to decide about. (`<details>` here
 * would also inherit the CollectionView trap: any explicit `display` on the
 * body defeats the UA rule that hides a closed panel.)
 */
export function FaqSection({
  items,
  heading = "Questions painters ask",
  id = "faq",
}: {
  items: ReadonlyArray<FaqEntry>;
  heading?: string;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-3xl px-6 pb-16">
      <h2 className="mb-6 text-center font-h1 text-h1 text-cyan-lite text-glow-cyan">
        {heading}
      </h2>
      <dl className="flex flex-col gap-4">
        {items.map(({ q, a }) => (
          <Panel key={q} className="p-5">
            <dt className="label-osd-h2 text-fg-bright">{q}</dt>
            <dd className="mt-2 font-body text-body leading-relaxed text-fg">{a}</dd>
          </Panel>
        ))}
      </dl>
    </section>
  );
}

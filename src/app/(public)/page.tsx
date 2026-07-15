import type { Metadata } from "next";
import { LandingView } from "@/components/public/LandingView";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqPageJsonLd, webApplicationJsonLd } from "@/lib/seo/structuredData";

export const metadata: Metadata = {
  title: "The Mini Mainframe — paint & project manager for miniatures",
  description:
    "One command center for your whole hobby — paint library, colour tools, recipes, collection, and project tracking. Free to start, Pro when you need it.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <JsonLd data={webApplicationJsonLd()} />
      <JsonLd data={faqPageJsonLd()} />
      <LandingView />
    </>
  );
}

import type { Metadata } from "next";
import { LandingView } from "@/components/public/LandingView";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqPageJsonLd, webApplicationJsonLd } from "@/lib/seo/structuredData";

export const metadata: Metadata = {
  title: "Miniature Painting Tracker & Paint Collection Manager · Mini Mainframe",
  description:
    "The miniature painting tracker and paint collection manager for wargamers — track your armies from wishlist to finished, save cross-brand paint recipes for Warhammer, Citadel, Vallejo and Army Painter, and clear your pile of shame. Free to start.",
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

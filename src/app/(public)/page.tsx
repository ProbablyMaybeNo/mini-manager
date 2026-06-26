import type { Metadata } from "next";
import { LandingView } from "@/components/public/LandingView";

export const metadata: Metadata = {
  title: "The Mini Mainframe — paint & project manager for miniatures",
  description:
    "One command center for your whole hobby — paint library, colour tools, recipes, collection, and project tracking. Free to start, Pro when you need it.",
};

export default function LandingPage() {
  return <LandingView />;
}

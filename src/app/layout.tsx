import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NavRail } from "@/components/NavRail";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileHeader } from "@/components/MobileHeader";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mini Manager",
  description:
    "A wargaming + painting companion. Plan armies, track every model from wishlist to complete, build paint recipes from a cross-brand library.",
  applicationName: "Mini Manager",
};

export const viewport: Viewport = {
  themeColor: "#050607",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plexMono.variable} ${plexSans.variable}`}>
      <body>
        <MobileHeader />
        <div className="flex min-h-screen">
          <NavRail />
          <main className="flex-1 min-w-0 pt-12 pb-20 md:pt-0 md:pb-0">{children}</main>
        </div>
        <BottomTabBar />
        <GlobalSearch />
      </body>
    </html>
  );
}

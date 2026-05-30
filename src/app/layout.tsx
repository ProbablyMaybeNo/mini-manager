import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NavRail } from "@/components/NavRail";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileHeader } from "@/components/MobileHeader";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { auth } from "@/auth";
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

/**
 * Read package version at module-evaluation time (server-only). Used by
 * the NavRail footer build-label.
 */
import packageJson from "../../package.json" with { type: "json" };

const APP_VERSION: string = (packageJson as { version: string }).version;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAuthed = Boolean(session?.user?.id);

  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      }
    : null;

  return (
    <html lang="en" className={`${plexMono.variable} ${plexSans.variable}`}>
      <body>
        {isAuthed ? <MobileHeader user={user} /> : null}
        <div className="flex min-h-screen">
          {isAuthed ? <NavRail user={user} appVersion={APP_VERSION} /> : null}
          <main className={isAuthed ? "flex-1 min-w-0 pt-12 pb-20 md:pt-0 md:pb-0" : "flex-1 min-w-0"}>
            {children}
          </main>
        </div>
        {isAuthed ? <BottomTabBar /> : null}
        {isAuthed ? <GlobalSearch /> : null}
      </body>
    </html>
  );
}

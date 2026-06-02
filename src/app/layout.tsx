import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { clsx } from "clsx";
import { NavRail } from "@/components/NavRail";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileHeader } from "@/components/MobileHeader";
import { StatusBar } from "@/components/StatusBar";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ToastProvider } from "@/components/ui/Toast";
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Mini Manager",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // UX-1212 — the newer cross-browser standalone hint. `appleWebApp.capable`
  // above emits `apple-mobile-web-app-capable`; this adds the unprefixed
  // `mobile-web-app-capable` so Android/Chrome "Add to Home Screen" also
  // launches fully standalone.
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#050607",
  width: "device-width",
  initialScale: 1,
  // UX-1212 — extend the standalone app into notched-device safe areas.
  // Paired with env(safe-area-inset-*) padding on the fixed chrome.
  viewportFit: "cover",
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
        <ServiceWorkerRegistrar />
        <ToastProvider>
          {isAuthed ? <StatusBar /> : null}
          {isAuthed ? <MobileHeader user={user} /> : null}
          {/* md:pt-6 offsets the 24px fixed StatusBar on desktop. */}
          <div className={clsx("flex min-h-screen", isAuthed && "md:pt-6")}>
            {isAuthed ? <NavRail user={user} appVersion={APP_VERSION} /> : null}
            <main className={isAuthed ? "flex-1 min-w-0 pt-12 pb-20 md:pt-0 md:pb-0" : "flex-1 min-w-0"}>
              {children}
            </main>
          </div>
          {isAuthed ? <BottomTabBar /> : null}
          {isAuthed ? <GlobalSearch /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}

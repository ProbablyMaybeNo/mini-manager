import type { Metadata, Viewport } from "next";
import { NavRail } from "@/components/NavRail";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileHeader } from "@/components/MobileHeader";
import { StatusBarServer } from "@/components/StatusBarServer";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ToastProvider } from "@/components/ui/Toast";
import { auth } from "@/auth";
import { DENSITY_BOOTSTRAP_SCRIPT } from "@/lib/hooks/useDensity";
import "./globals.css";

// Fonts are self-hosted via @font-face in globals.css (public/fonts/*.woff2)
// — no runtime Google Fonts fetch. The family names ("IBM Plex Mono",
// "IBM Plex Sans", "Share Tech Mono", "Press Start 2P") resolve straight
// from the bundled .woff2 faces.

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
    <html lang="en">
      <body>
        {/* D1 — apply the stored Comfortable/Compact density to <html>
            before first paint so there is no comfortable→compact flash
            on reload. Runs synchronously ahead of the body content. */}
        <script dangerouslySetInnerHTML={{ __html: DENSITY_BOOTSTRAP_SCRIPT }} />
        <ServiceWorkerRegistrar />
        <ToastProvider>
          {isAuthed ? <MobileHeader user={user} /> : null}
          {/* UI-CHROME — Phase-0 re-introduces a FUNCTIONAL top strip
              (StatusBar): live clock + current Focus project + quick stats
              (active projects / streak), reusing the dashboard KPI + streak
              helpers. It sits at the top of the content column so it spans
              the page (not the NavRail), and collapses to a compact line on
              mobile under the fixed MobileHeader. The old dead SYS/OK strip
              stays gone — this one earns its space. */}
          <div className="flex min-h-screen">
            {isAuthed ? <NavRail user={user} appVersion={APP_VERSION} /> : null}
            <main className={isAuthed ? "flex-1 min-w-0 pt-12 pb-20 md:pt-0 md:pb-0" : "flex-1 min-w-0"}>
              {isAuthed && session?.user?.id ? (
                <StatusBarServer userId={session.user.id} />
              ) : null}
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

import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeOverrides } from "@/components/dev/ThemeOverrides";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mini-mainframe.com"),
  title: "The Mini Mainframe",
  description:
    "One terminal for your whole hobby — 7,000+ paints, colour tools, recipes, collection, and project tracking for miniature painters. Free to start.",
  applicationName: "The Mini Mainframe",
  // Explicit Open Graph + Twitter so every link unfurl (Reddit, Discord,
  // Facebook, X, Slack, iMessage) shows the branded card with a controlled
  // title/description and the large-image layout — not a bare <title>. The
  // og:image / twitter:image themselves come from the file-based
  // opengraph-image.tsx / twitter-image.tsx in (public) and are merged in.
  openGraph: {
    type: "website",
    siteName: "The Mini Mainframe",
    title: "The Mini Mainframe — paint & project manager for miniatures",
    description:
      "One terminal for your whole hobby — 7,000+ paints, colour tools, recipes, collection, and project tracking. Free to start.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Mini Mainframe — paint & project manager for miniatures",
    description:
      "One terminal for your whole hobby — 7,000+ paints, colour tools, recipes, collection, and project tracking. Free to start.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "The Mini Mainframe",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {process.env.NODE_ENV !== "production" && <ThemeOverrides />}
        {children}
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}

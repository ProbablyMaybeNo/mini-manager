import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeOverrides } from "@/components/dev/ThemeOverrides";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mini-mainframe.com"),
  title: "The Mini Mainframe",
  description:
    "Command center for miniature & wargaming painters — projects, paints, recipes, and the focus bench.",
  applicationName: "The Mini Mainframe",
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
  themeColor: "#000000",
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
        <Analytics />
      </body>
    </html>
  );
}

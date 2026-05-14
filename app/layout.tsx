import type { Metadata, Viewport } from "next";

import "@/lib/env";

import { LanguageProvider } from "@/components/providers/language-provider";
import RestaurantJsonLd from "@/components/seo/restaurant-json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Buffet asiatique à volonté à Châteauguay avec sushis, woks, grillades, dim sum, desserts et réservation en ligne.",
  alternates: {
    canonical: "/",
  },
  category: "restaurant",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "Buffet asiatique à volonté à Châteauguay avec sushis, woks, grillades, dim sum, desserts et réservation en ligne.",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Buffet asiatique à volonté à Châteauguay avec sushis, woks, grillades, dim sum, desserts et réservation en ligne.",
    images: ["/android-chrome-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#041F18",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className="font-sans"
        style={{
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <RestaurantJsonLd />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

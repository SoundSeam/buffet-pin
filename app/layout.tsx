import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/providers/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buffet PIN",
  description: "Asian buffet restaurant in Chateauguay | Buffet asiatique a volonte a Chateauguay.",
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
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

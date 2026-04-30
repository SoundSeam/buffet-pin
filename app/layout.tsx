import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buffet PIN",
  description: "Buffet asiatique a volonte a Chateauguay.",
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
        {children}
      </body>
    </html>
  );
}

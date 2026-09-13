import type { ReactNode } from "react";
import Footer from "@/components/layout/footer";
import LanguageToggle from "@/components/layout/language-toggle";
import Navbar from "@/components/layout/navbar";

type SiteShellProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: boolean;
  theme?: "default" | "drinks";
};

export default function SiteShell({ children, header, footer = true, theme = "default" }: SiteShellProps) {
  return (
    <div className={theme === "drinks" ? "min-h-screen bg-[#020305] text-white" : "min-h-screen bg-[#041F18]"}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {header ?? <Navbar theme={theme} />}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <div
        className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <LanguageToggle theme={theme} />
      </div>
      {footer ? <Footer theme={theme} /> : null}
    </div>
  );
}

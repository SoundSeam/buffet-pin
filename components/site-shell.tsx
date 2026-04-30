import type { ReactNode } from "react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";

type SiteShellProps = {
  children: ReactNode;
};

export default function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="min-h-screen bg-[#041F18]">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

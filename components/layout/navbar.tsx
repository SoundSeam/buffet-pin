"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";

const LOGO =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+PIN-Logo+Horizontal.png";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const mobileMenuId = "primary-navigation-mobile";
  const { copy } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "backdrop-blur-xl" : ""
      }`}
      style={{ background: "#041F18" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between lg:h-24">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Buffet PIN">
            <img
              src={LOGO}
              alt="Buffet PIN"
              className="block h-10 w-auto object-contain lg:h-12"
            />
          </Link>

          <div className="hidden items-center justify-end gap-10 lg:flex lg:ml-auto">
            {copy.navbar.links.map((link) => (
              <Link
                key={link.label}
                href={link.path}
                className="group relative text-sm font-medium text-white/80 transition-colors duration-300 hover:text-[#C9A56A]"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#C9A56A] transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}

            <Link
              href="/reservation"
              className="rounded bg-[#C9A56A] px-6 py-2.5 text-sm font-semibold text-[#062F24] transition-all duration-300 hover:opacity-90"
            >
              {copy.navbar.reserve}
            </Link>
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
              className="min-h-11 min-w-11 rounded-md bg-[#C9A56A] p-2 text-[#062F24] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A56A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#062F24]"
              aria-controls={mobileMenuId}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? copy.navbar.closeMenu : copy.navbar.openMenu}
            >
              {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id={mobileMenuId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[#C9A56A]/10 lg:hidden"
            style={{ background: "#041F18" }}
          >
            <div className="space-y-6 px-6 py-8">
              {copy.navbar.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.path}
                  className="block text-base font-medium text-white/80 transition-colors hover:text-[#C9A56A]"
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="/reservation"
                className="inline-flex min-h-11 w-full items-center justify-center rounded bg-[#C9A56A] px-4 py-3 text-sm font-semibold text-[#062F24] transition-all duration-300 hover:opacity-90"
              >
                {copy.navbar.reserve}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

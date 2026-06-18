"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/components/providers/language-provider";
import {
  AnimatedWords,
  blurItemVariants,
  staggerGroupVariants,
} from "@/components/home/smooth-reveal";

const LOGO =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+PIN-Logo+Horizontal.png";
const LOGO_BLACK =
  "https://soundseam-origin.s3.us-east-2.amazonaws.com/misc/Buffet+PIN-Logo+HorizontalBlack.png";
const HEADER_GREEN = "#041F18";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const mobileMenuId = "primary-navigation-mobile";
  const { copy } = useTranslation();
  const isHomePage = pathname === "/";
  const useHomeHeader = isHomePage;
  const showHomeTransparentHeader = useHomeHeader && !scrolled && !mobileOpen;
  const navBackground = showHomeTransparentHeader
    ? "transparent"
    : useHomeHeader
      ? HEADER_GREEN
      : "#ffffff";
  const navClassName = useHomeHeader
    ? `fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "backdrop-blur-xl shadow-[0_1px_0_rgba(201,165,106,0.12)]" : ""
      }`
    : "fixed left-0 right-0 top-0 z-50";
  const logoSrc = useHomeHeader ? LOGO : LOGO_BLACK;
  const navLinkClassName = useHomeHeader
    ? "group relative text-sm font-medium text-white/80 transition-colors duration-300 hover:text-[#C9A56A]"
    : "group relative text-sm font-medium text-black hover:text-[#041F18]";
  const reserveClassName = useHomeHeader
    ? "inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-6 py-2.5 text-sm font-semibold text-[#062F24] transition-all duration-300 hover:opacity-90"
    : "inline-flex items-center justify-center rounded-button bg-[#041F18] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90";
  const mobileButtonClassName = useHomeHeader
    ? "min-h-11 min-w-11 rounded-icon bg-[#C9A56A] p-2 text-[#062F24] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A56A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#062F24]"
    : "min-h-11 min-w-11 rounded-icon bg-[#041F18] p-2 text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#041F18] focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  const mobileMenuClassName = useHomeHeader
    ? "overflow-hidden border-t border-[#C9A56A]/10 lg:hidden"
    : "overflow-hidden lg:hidden";
  const mobileMenuStyle = { background: useHomeHeader ? HEADER_GREEN : "#ffffff" };
  const mobileLinkClassName = useHomeHeader
    ? "block text-base font-medium text-white/80 transition-colors hover:text-[#C9A56A]"
    : "block text-base font-medium text-black hover:text-[#041F18]";
  const mobileReserveClassName = useHomeHeader
    ? "inline-flex min-h-11 w-full items-center justify-center rounded-button bg-[#C9A56A] px-4 py-3 text-sm font-semibold text-[#062F24] transition-all duration-300 hover:opacity-90"
    : "inline-flex min-h-11 w-full items-center justify-center rounded-button bg-[#041F18] px-4 py-3 text-sm font-semibold text-white hover:opacity-90";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!useHomeHeader) {
    return (
      <nav className={navClassName} style={{ background: navBackground }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-20">
            <Link href="/" className="flex shrink-0 items-center" aria-label="Buffet PIN">
              <img
                src={logoSrc}
                alt="Buffet PIN"
                className="block h-8 w-auto object-contain lg:h-10"
              />
            </Link>

            <div className="hidden items-center justify-end gap-10 lg:ml-auto lg:flex">
              {copy.navbar.links.map((link) => (
                <Link key={link.label} href={link.path} className={navLinkClassName}>
                  {link.label}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#C9A56A] group-hover:w-full" />
                </Link>
              ))}

              <Link href="/reservation" className={reserveClassName}>
                {copy.navbar.reserve}
              </Link>
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setMobileOpen((open) => !open)}
                type="button"
                className={mobileButtonClassName}
                aria-controls={mobileMenuId}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? copy.navbar.closeMenu : copy.navbar.openMenu}
              >
                {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen ? (
          <div id={mobileMenuId} className={mobileMenuClassName} style={mobileMenuStyle}>
            <div className="space-y-6 px-6 py-8">
              {copy.navbar.links.map((link) => (
                <Link key={link.label} href={link.path} className={mobileLinkClassName}>
                  {link.label}
                </Link>
              ))}

              <Link href="/reservation" className={mobileReserveClassName}>
                {copy.navbar.reserve}
              </Link>
            </div>
          </div>
        ) : null}
      </nav>
    );
  }

  return (
    <nav className={navClassName} style={{ background: navBackground }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="flex h-16 items-center justify-between lg:h-20"
          initial="hidden"
          animate="visible"
          variants={staggerGroupVariants}
        >
          <motion.div variants={blurItemVariants}>
            <Link href="/" className="flex shrink-0 items-center" aria-label="Buffet PIN">
              <img
                src={logoSrc}
                alt="Buffet PIN"
                className="block h-8 w-auto object-contain lg:h-10"
              />
            </Link>
          </motion.div>

          <motion.div
            className="hidden items-center justify-end gap-10 lg:ml-auto lg:flex"
            variants={staggerGroupVariants}
          >
            {copy.navbar.links.map((link) => (
              <motion.div key={link.label} variants={blurItemVariants}>
                <Link href={link.path} className={navLinkClassName}>
                  <AnimatedWords
                    as="span"
                    className="inline-flex"
                    reveal="mount"
                    stagger={0.04}
                    text={link.label}
                  />
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#C9A56A] transition-all duration-300 group-hover:w-full" />
                </Link>
              </motion.div>
            ))}

            <motion.div variants={blurItemVariants}>
              <Link href="/reservation" className={reserveClassName}>
                <AnimatedWords
                  as="span"
                  className="inline-flex"
                  reveal="mount"
                  stagger={0.04}
                  text={copy.navbar.reserve}
                />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div className="flex items-center gap-3 lg:hidden" variants={blurItemVariants}>
            <button
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
              className={mobileButtonClassName}
              aria-controls={mobileMenuId}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? copy.navbar.closeMenu : copy.navbar.openMenu}
            >
              {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </motion.div>
        </motion.div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id={mobileMenuId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={mobileMenuClassName}
            style={mobileMenuStyle}
          >
            <div className="space-y-6 px-6 py-8">
              {copy.navbar.links.map((link) => (
                <Link key={link.label} href={link.path} className={mobileLinkClassName}>
                  {link.label}
                </Link>
              ))}

              <Link href="/reservation" className={mobileReserveClassName}>
                {copy.navbar.reserve}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

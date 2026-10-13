"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  FaBookOpen,
  FaBars,
  FaCalendarDays,
  FaChartLine,
  FaClipboardList,
  FaCode,
  FaFileInvoiceDollar,
  FaGear,
  FaHeartPulse,
  FaMoneyBillTransfer,
  FaPersonBiking,
  FaReceipt,
  FaRightFromBracket,
  FaScrewdriverWrench,
  FaTriangleExclamation,
  FaUtensils,
  FaXmark,
} from "react-icons/fa6";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buffetPinMedia } from "@/lib/media";

const LOGO_BLACK = buffetPinMedia.logoHorizontalBlack;

type AdminNavigationItem = {
  href: string;
  icon: IconType;
  label: string;
  roles: AdminStaffRole[];
};

type AdminStaffRole =
  "MANAGER" | "OPERATOR" | "DISPATCHER" | "REPORTING" | "TECHNICAL";

type ShellAudience = "restaurant" | "reports" | "developer";

const managerOnly: AdminStaffRole[] = ["MANAGER"];

const restaurantNavigation: AdminNavigationItem[] = [
  {
    href: "/admin/orders",
    icon: FaClipboardList,
    label: "Kitchen Controller",
    roles: ["MANAGER", "OPERATOR"],
  },
  {
    href: "/admin/drivers",
    icon: FaPersonBiking,
    label: "Drivers",
    roles: ["MANAGER", "DISPATCHER"],
  },
  {
    href: "/admin/reservations",
    icon: FaCalendarDays,
    label: "Reservations",
    roles: managerOnly,
  },
  { href: "/admin/menu", icon: FaUtensils, label: "Menu", roles: managerOnly },
  {
    href: "/admin/settings",
    icon: FaGear,
    label: "Settings",
    roles: managerOnly,
  },
];

const reportsNavigation: AdminNavigationItem[] = [
  {
    href: "/reports",
    icon: FaChartLine,
    label: "Overview",
    roles: ["MANAGER", "REPORTING"],
  },
  {
    href: "/reports/daily",
    icon: FaCalendarDays,
    label: "Daily",
    roles: ["MANAGER", "REPORTING"],
  },
  {
    href: "/reports/monthly",
    icon: FaFileInvoiceDollar,
    label: "Monthly",
    roles: ["MANAGER", "REPORTING"],
  },
  {
    href: "/reports/orders",
    icon: FaReceipt,
    label: "Orders",
    roles: ["MANAGER", "REPORTING"],
  },
  {
    href: "/reports/refunds",
    icon: FaMoneyBillTransfer,
    label: "Refunds",
    roles: ["MANAGER", "REPORTING"],
  },
  { href: "/admin", icon: FaUtensils, label: "Restaurant", roles: ["MANAGER"] },
];

const developerNavigation: AdminNavigationItem[] = [
  {
    href: "/dev",
    icon: FaHeartPulse,
    label: "System health",
    roles: ["TECHNICAL"],
  },
  {
    href: "/dev/operations",
    icon: FaTriangleExclamation,
    label: "Problems and recovery",
    roles: ["TECHNICAL"],
  },
  {
    href: "/dev/clover/catalog",
    icon: FaBookOpen,
    label: "Clover menu connection",
    roles: ["TECHNICAL"],
  },
  {
    href: "/dev/reconciliation",
    icon: FaMoneyBillTransfer,
    label: "Money comparison",
    roles: ["TECHNICAL"],
  },
  {
    href: "/dev/machine-test",
    icon: FaScrewdriverWrench,
    label: "Clover and printer test",
    roles: ["TECHNICAL"],
  },
  {
    href: "/dev/audit",
    icon: FaCode,
    label: "Audit history",
    roles: ["TECHNICAL"],
  },
];

const shellConfiguration = {
  restaurant: {
    homeHref: "/admin",
    navigationLabel: "Restaurant operations",
    navigation: restaurantNavigation,
  },
  reports: {
    homeHref: "/reports",
    navigationLabel: "Reports",
    navigation: reportsNavigation,
  },
  developer: {
    homeHref: "/dev",
    navigationLabel: "Developer tools",
    navigation: developerNavigation,
  },
} satisfies Record<
  ShellAudience,
  {
    homeHref: string;
    navigationLabel: string;
    navigation: AdminNavigationItem[];
  }
>;

function isSelected(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminHeader({
  authenticated,
  homeHref,
  menuOpen,
  signingOut,
  onMenuToggle,
  onSignOut,
}: {
  authenticated: boolean;
  homeHref: string;
  menuOpen: boolean;
  signingOut: boolean;
  onMenuToggle: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-neutral-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6 lg:h-20 lg:px-8">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center"
          aria-label={authenticated ? "Buffet PIN admin" : "Buffet PIN"}
        >
          {/* The public navbar uses the same externally hosted brand asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_BLACK}
            alt="Buffet PIN"
            className="block h-6 w-auto object-contain sm:h-8 lg:h-10"
          />
        </Link>

        {authenticated ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-[#062F24] transition hover:bg-neutral-100 lg:hidden"
              aria-controls="admin-sidebar"
              aria-expanded={menuOpen}
              aria-label={
                menuOpen ? "Close admin navigation" : "Open admin navigation"
              }
              onClick={onMenuToggle}
            >
              {menuOpen ? (
                <FaXmark className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FaBars className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              aria-label="Sign Out"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#062F24] transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={signingOut}
              onClick={onSignOut}
            >
              <FaRightFromBracket className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {signingOut ? "Signing out…" : "Sign Out"}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default function AdminShell({
  children,
  staffRole,
  audience = "restaurant",
}: {
  children: ReactNode;
  staffRole: AdminStaffRole | null;
  audience?: ShellAudience;
}) {
  const pathname = usePathname();
  const isLogin = audience === "restaurant" && pathname === "/admin/login";
  const configuration = shellConfiguration[audience];
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  if (isLogin) {
    return (
      <div className="min-h-screen bg-white">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AdminHeader
          authenticated={false}
          homeHref="/"
          menuOpen={false}
          signingOut={false}
          onMenuToggle={() => undefined}
          onSignOut={() => undefined}
        />
        <main id="main-content" tabIndex={-1} className="pt-16 lg:pt-20">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#062F24]">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <AdminHeader
        authenticated
        homeHref={configuration.homeHref}
        menuOpen={menuOpen}
        signingOut={signingOut}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onSignOut={() => void signOut()}
      />

      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-16 z-30 min-h-0 bg-black/20 backdrop-blur-[1px] lg:hidden"
          aria-label="Close admin navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={`fixed bottom-0 left-0 top-16 z-40 w-72 overflow-y-auto overscroll-contain border-r border-neutral-200 bg-white py-6 transition-transform duration-200 lg:top-20 lg:translate-x-0 ${
          menuOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full lg:visible"
        }`}
      >
        <nav
          aria-label={configuration.navigationLabel}
          className="space-y-1 pr-4"
        >
          {configuration.navigation
            .filter((item) => staffRole && item.roles.includes(staffRole))
            .map((item) => {
              const selected = isSelected(pathname, item.href);
              const Icon = item.icon;

              return (
                <div key={item.href} className="relative">
                  {selected ? (
                    <span
                      className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[#062F24]"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Link
                    href={item.href}
                    aria-current={selected ? "page" : undefined}
                    className={`ml-5 flex min-h-11 items-center gap-3 rounded-button px-4 py-2.5 text-sm font-semibold transition-colors ${
                      selected
                        ? "bg-neutral-100 text-[#062F24]"
                        : "text-[#062F24]/70 hover:bg-neutral-50 hover:text-[#062F24]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </div>
              );
            })}
        </nav>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-[100dvh] min-w-0 bg-white pt-16 lg:pl-72 lg:pt-20"
      >
        {children}
      </main>
    </div>
  );
}

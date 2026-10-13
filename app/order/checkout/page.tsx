import { buffetPinMedia } from "@/lib/media";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import LanguageToggle from "@/components/layout/language-toggle";
import OrderFlow from "@/components/order/order-flow";
import SiteShell from "@/components/site-shell";
import { buffetPinMedia } from "@/lib/media";

const CHECKOUT_LOGO = buffetPinMedia.logoHorizontalBlack;

export const metadata: Metadata = {
  title: "Place Order",
  description: "Review and place your Buffet Pin order before payment.",
};

export default function OrderCheckoutPage() {
  return (
    <SiteShell header={<CheckoutHeader />} footer={false} languageToggle={false}>
      <OrderFlow initialStep="checkout" />
    </SiteShell>
  );
}

function CheckoutHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20 lg:px-8">
        <Link
          href="/order"
          className="inline-flex items-center gap-2 text-sm font-bold text-black transition hover:text-neutral-600"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Back to store
        </Link>
        <Link href="/" className="flex shrink-0 items-center" aria-label="Buffet PIN">
          <img
            src={CHECKOUT_LOGO}
            alt="Buffet PIN"
            className="block h-8 w-auto object-contain lg:h-10"
          />
        </Link>
        <div className="fixed right-4 top-4 z-[70] sm:right-6 lg:right-8 lg:top-5">
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}

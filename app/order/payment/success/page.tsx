import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import SiteShell from "@/components/site-shell";

const pageContainerClass = "mx-auto max-w-7xl px-6 lg:px-8";
const cardClass = "rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm sm:p-6";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-5 py-3 font-extrabold text-[#062F24] transition hover:bg-[#D6B77F]";

export const metadata: Metadata = {
  title: "Payment Received",
  description: "Buffet Pin hosted payment redirect received.",
};

export default async function OrderPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; payment?: string; source?: string }>;
}) {
  const { order, payment, source } = await searchParams;

  if (order) {
    const params = new URLSearchParams();
    if (payment) params.set("payment", payment);
    params.set("source", source ?? "clover_success");

    redirect(`/order/${encodeURIComponent(order)}?${params.toString()}`);
  }

  return (
    <SiteShell>
      <section className="bg-white pb-20 text-[#062F24]">
        <div className="bg-[#062F24] pb-16 pt-28 lg:pt-32">
          <div className={pageContainerClass}>
            <p className="text-sm font-bold uppercase text-[#C9A56A]">Payment status</p>
            <h1 className="text-4xl font-extrabold leading-tight text-[#F4E8D2]">
              Payment submitted
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[rgba(244,232,210,0.72)]">
              This fallback payment link did not include an order code.
            </p>
          </div>
        </div>

        <div className={`${pageContainerClass} mt-10`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className={cardClass}>
              <CheckCircle2 size={24} className="text-[#C9A56A]" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-extrabold">Open your order status</h2>
              <p className="mt-3 text-sm leading-6 text-[#062F24]/65">
                Your order status page updates after payment reconciliation. Use the tracking link
                from your order flow, or start a new order.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/order" className={primaryButtonClass}>
                  Start another order
                </Link>
              </div>
            </div>

            <aside className={cardClass}>
              <h2 className="text-xl font-extrabold">Next step</h2>
              <div className="mt-4 border-t border-[rgba(6,47,36,0.1)] pt-4">
                <p className="text-sm leading-6 text-[#062F24]/65">
                  This Hosted Checkout fallback page does not change order payment state.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

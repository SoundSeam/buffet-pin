import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import SiteShell from "@/components/site-shell";

const pageContainerClass = "mx-auto max-w-7xl px-6 lg:px-8";
const cardClass = "rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-5 text-[#062F24] shadow-sm sm:p-6";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-5 py-3 font-extrabold text-[#062F24] transition hover:bg-[#D6B77F]";

export const metadata: Metadata = {
  title: "Payment Not Completed",
  description: "Buffet Pin hosted payment was not completed.",
};

export default async function OrderPaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ error_code?: string; order?: string; tracking?: string }>;
}) {
  const { error_code: errorCode, order, tracking } = await searchParams;

  return (
    <SiteShell>
      <section className="bg-white pb-20 text-[#062F24]">
        <div className="bg-[#062F24] pb-16 pt-28 lg:pt-32">
          <div className={pageContainerClass}>
            <p className="text-sm font-bold uppercase text-[#C9A56A]">Payment status</p>
            <h1 className="text-4xl font-extrabold leading-tight text-[#F4E8D2]">
              Payment not completed
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[rgba(244,232,210,0.72)]">
              This Hosted Checkout fallback did not return a completed payment. Your order state is still controlled by server reconciliation.
            </p>
          </div>
        </div>

        <div className={`${pageContainerClass} mt-10`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className={cardClass}>
              <AlertCircle size={24} className="text-[#9F2A2A]" aria-hidden="true" />
              {order ? (
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-[#062F24]/55">
                  Order {order}
                </p>
              ) : null}
              <h2 className={order ? "mt-3 text-2xl font-extrabold" : "mt-4 text-2xl font-extrabold"}>
                No payment confirmation was applied
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#062F24]/65">
                This fallback page does not mark the order failed or paid.
              </p>
              {errorCode ? (
                <p className="mt-4 rounded-surface border border-[#A33A32]/25 bg-[#A33A32]/10 p-4 text-sm font-semibold text-[#7A211B]">
                  Clover error: {errorCode}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/order/checkout" className={primaryButtonClass}>
                  Return to checkout
                </Link>
                {tracking ? (
                  <Link
                    href={`/order/${encodeURIComponent(tracking)}`}
                    className="inline-flex items-center justify-center rounded-button border border-[rgba(6,47,36,0.14)] px-5 py-3 font-bold text-[#062F24] transition hover:bg-[rgba(6,47,36,0.04)]"
                  >
                    View order status
                  </Link>
                ) : null}
              </div>
            </div>

            <aside className={cardClass}>
              <h2 className="text-xl font-extrabold">Next step</h2>
              <div className="mt-4 border-t border-[rgba(6,47,36,0.1)] pt-4">
                <p className="text-sm leading-6 text-[#062F24]/65">
                  You can return to checkout to try payment again. Server reconciliation and
                  payment webhooks remain the source of truth.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

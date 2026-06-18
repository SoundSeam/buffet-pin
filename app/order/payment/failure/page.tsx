import type { Metadata } from "next";
import Link from "next/link";

import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Payment Not Completed",
  description: "Buffet Pin payment was not completed in Clover.",
};

export default async function OrderPaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ error_code?: string; order?: string }>;
}) {
  const { error_code: errorCode, order } = await searchParams;

  return (
    <SiteShell>
      <section className="bg-white pb-20">
        <div className="bg-[#062F24] pb-16 pt-28 lg:pt-32">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold leading-tight text-[#F4E8D2]">
              Payment not completed
            </h1>
            <p className="mt-3 text-base leading-7 text-[rgba(244,232,210,0.72)]">
              Clover returned without a completed payment. Your order payment state is still controlled by server reconciliation.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-3xl px-6 lg:px-8">
          <div className="rounded-surface border border-[rgba(6,47,36,0.1)] bg-white p-6 text-[#062F24] shadow-sm">
            {order ? (
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#062F24]/55">
                Order {order}
              </p>
            ) : null}
            <h2 className="mt-3 text-2xl font-extrabold">No payment confirmation was applied</h2>
            <p className="mt-3 text-sm leading-6 text-[#062F24]/65">
              This page is only a customer redirect destination. It does not mark the order failed or paid.
            </p>
            {errorCode ? (
              <p className="mt-4 rounded-surface border border-[#A33A32]/25 bg-[#A33A32]/10 p-4 text-sm font-semibold text-[#7A211B]">
                Clover error: {errorCode}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/order/checkout"
                className="inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-5 py-3 font-extrabold text-[#062F24]"
              >
                Return to checkout
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

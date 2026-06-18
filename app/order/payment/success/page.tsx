import type { Metadata } from "next";
import Link from "next/link";

import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Payment Received",
  description: "Buffet Pin payment redirect received.",
};

export default async function OrderPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <SiteShell>
      <section className="bg-white pb-20">
        <div className="bg-[#062F24] pb-16 pt-28 lg:pt-32">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <h1 className="text-4xl font-extrabold leading-tight text-[#F4E8D2]">
              Payment submitted
            </h1>
            <p className="mt-3 text-base leading-7 text-[rgba(244,232,210,0.72)]">
              Clover sent you back to Buffet Pin. Your order will be confirmed after payment reconciliation.
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
            <h2 className="mt-3 text-2xl font-extrabold">Payment pending verification</h2>
            <p className="mt-3 text-sm leading-6 text-[#062F24]/65">
              This page does not mark the order as paid. Buffet Pin will use Clover webhook reconciliation as the source of truth.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/order"
                className="inline-flex items-center justify-center rounded-button bg-[#C9A56A] px-5 py-3 font-extrabold text-[#062F24]"
              >
                Start another order
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

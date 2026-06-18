import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CustomerStatusPage from "@/components/order/customer-status-page";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Order Status",
  description: "View your Buffet Pin order status.",
};

export default async function OrderStatusRoute({
  params,
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;

  if (publicCode.toLowerCase() === "cart") {
    notFound();
  }

  return (
    <SiteShell>
      <CustomerStatusPage publicCode={publicCode} />
    </SiteShell>
  );
}

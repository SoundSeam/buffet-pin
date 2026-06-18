import type { Metadata } from "next";

import OrderFlow from "@/components/order/order-flow";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Order Online",
  description: "Order Buffet Pin delivery online.",
};

export default function OrderPage() {
  return (
    <SiteShell>
      <OrderFlow initialStep="menu" />
    </SiteShell>
  );
}

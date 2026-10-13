import { notFound } from "next/navigation";
import { getProviderMode } from "@/lib/env";
import {
  FakeOrderFlowHarness,
  createRecoverablePrintFailureHarness,
} from "@/lib/testing/fake-order-flow";

export const dynamic = "force-dynamic";

export default async function FakeOrderFlowPage() {
  if (process.env.NODE_ENV === "production" || getProviderMode() !== "fake") {
    notFound();
  }

  const delivered = await new FakeOrderFlowHarness().start();
  const recoveryHarness = createRecoverablePrintFailureHarness();
  const failed = await recoveryHarness.start();
  const failureSnapshot = structuredClone(failed);
  const recovered = await recoveryHarness.recoverPrint();

  return (
    <main style={{ margin: "0 auto", maxWidth: 760, padding: 32, fontFamily: "system-ui" }}>
      <h1>Buffet Pin Direct fake-flow verification</h1>
      <section aria-label="delivered-order">
        <h2>Complete flow</h2>
        <dl>
          <dt>Order</dt>
          <dd>{delivered.orderNumber}</dd>
          <dt>Payment</dt>
          <dd>{delivered.payment}</dd>
          <dt>Print</dt>
          <dd>{delivered.print}</dd>
          <dt>Production</dt>
          <dd>{delivered.production}</dd>
          <dt>Dispatch</dt>
          <dd>{delivered.dispatch}</dd>
        </dl>
      </section>

      <section aria-label="print-exception">
        <h2>Injected printer outage</h2>
        <p>{failureSnapshot.exception?.kind}</p>
        <p>{failureSnapshot.exception?.recoveryAction}</p>
        <p>Recovered to: {recovered.dispatch}</p>
      </section>
    </main>
  );
}

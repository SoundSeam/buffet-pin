import "server-only";

import { db } from "@/lib/db";
import { parseTrackingCredential } from "@/lib/orders/tracking-credential";

export async function getDigitalReceipt(credentialValue: string) {
  const credential = parseTrackingCredential(credentialValue);
  if (!credential) return null;
  const order = await db.order.findFirst({
    where: credential.kind === "token" ? { trackingToken: credential.value } : { publicCode: credential.value, legacyPublicTrackingEnabled: true },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { modifiers: { orderBy: { createdAt: "asc" } } } },
      payments: { orderBy: { createdAt: "desc" }, select: { provider: true, providerPaymentId: true, providerOrderId: true, amountCents: true, refundedAmountCents: true, currency: true, paidAt: true, refundedAt: true } },
      refundIntents: { where: { status: "SUCCEEDED" }, select: { amountCents: true, providerRefundId: true, resolvedAt: true } },
    },
  });
  if (!order) return null;
  const settings = await db.restaurantOrderSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return {
    receiptVersion: 1,
    orderNumber: order.orderNumber,
    issuedAt: order.createdAt.toISOString(),
    merchant: {
      legalName: settings.receiptLegalName,
      address: settings.receiptAddress,
      phone: settings.receiptPhone,
      taxRegistration: settings.receiptTaxRegistration,
      complianceReviewRequired: true,
    },
    customer: { name: order.customerName },
    serviceType: order.serviceType,
    items: order.items.map((item) => ({
      name: item.menuItemNameSnapshot, quantity: item.quantity, unitPriceCents: item.unitPriceCents,
      modifiersTotalCents: item.modifiersTotalCents, lineSubtotalCents: item.lineSubtotalCents,
      modifiers: item.modifiers.map((modifier) => ({ name: modifier.modifierOptionNameSnapshot, priceDeltaCents: modifier.priceDeltaCents, quantity: modifier.quantity })),
    })),
    totals: {
      itemsSubtotalCents: order.itemsSubtotalCents, taxableSubtotalCents: order.taxableSubtotalCents,
      gstCents: order.gstCents, qstCents: order.qstCents, taxCents: order.taxCents,
      deliveryFeeCents: order.deliveryFeeCents, discountCents: order.discountCents, tipCents: order.tipCents,
      totalCents: order.totalCents, currency: order.currency,
    },
    paymentStatus: order.paymentStatus,
    refundStatus: order.refundStatus,
    payments: order.payments.map((payment) => ({ ...payment, paidAt: payment.paidAt?.toISOString() ?? null, refundedAt: payment.refundedAt?.toISOString() ?? null })),
    refunds: order.refundIntents.map((refund) => ({ ...refund, resolvedAt: refund.resolvedAt?.toISOString() ?? null })),
  };
}

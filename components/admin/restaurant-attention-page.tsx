"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Loader2, Printer, RefreshCw } from "lucide-react";

import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  adminButtonClass,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";

type Alert = {
  id: string;
  category: string;
  severity: string;
  orderNumber: string | null;
  summary: string;
};

function explain(alert: Alert) {
  if (alert.category.includes("PRINT")) {
    return {
      explanation: "We cannot confirm that the kitchen ticket printed.",
      consequence:
        "Do not prepare this order until a ticket is physically confirmed.",
      action: "Check the kitchen printer",
      href: "/admin/production",
      manager: false,
      printer: true,
    };
  }
  if (alert.category.includes("REFUND")) {
    return {
      explanation: "The refund has not been confirmed.",
      consequence: "Do not promise the customer that the money was returned.",
      action: "Ask a manager to review the order",
      href: "/admin/orders",
      manager: true,
      printer: false,
    };
  }
  if (alert.category.includes("NOTIFICATION")) {
    return {
      explanation: "The customer message was not delivered.",
      consequence: "The customer may not know the order status.",
      action: "Open the order and contact the customer",
      href: "/admin/orders",
      manager: false,
      printer: false,
    };
  }
  if (alert.category.includes("ROUTE") || alert.category.includes("DISPATCH")) {
    return {
      explanation: "This delivery needs dispatch review.",
      consequence:
        "The bag should remain at the dispatch desk until assigned safely.",
      action: "Open Dispatch",
      href: "/admin/dispatch",
      manager: false,
      printer: false,
    };
  }
  return {
    explanation: "This order needs a manager to review what happened.",
    consequence: "Keep the order visible and do not guess at the next state.",
    action: "Review the order",
    href: "/admin/orders",
    manager: true,
    printer: false,
  };
}

export default function RestaurantAttentionPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printerAnswer, setPrinterAnswer] = useState<Record<string, string>>(
    {},
  );
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/alerts", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok)
      throw new Error("Could not load orders needing attention.");
    setAlerts(body.data.alerts);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load().catch((caught) => {
      setError(String(caught));
      setLoading(false);
    });
  }, [load]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Needs attention"
        description="What happened, why it matters, and the next safe action."
        actions={
          <button
            className={adminButtonClass}
            style={adminQuietButtonStyle}
            onClick={() => void load()}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      {error ? (
        <AdminNotice tone="error" className="mt-6">
          {error}
        </AdminNotice>
      ) : null}
      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-[#062F24]/65">
          <Loader2 className="animate-spin" size={18} /> Loading orders
        </div>
      ) : null}
      {!loading && alerts.length === 0 ? (
        <div className="mt-8">
          <AdminEmptyState>No orders need attention.</AdminEmptyState>
        </div>
      ) : null}
      <div className="mt-8 grid gap-5">
        {alerts.map((alert) => {
          const guidance = explain(alert);
          return (
            <AdminPanel key={alert.id}>
              <div className="flex items-start gap-4">
                <CircleAlert
                  className="mt-1 h-6 w-6 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-extrabold text-[#062F24]">
                    {alert.orderNumber ?? "Restaurant issue"}
                  </p>
                  <p className="mt-3 font-semibold text-[#062F24]">
                    {guidance.explanation}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#062F24]/65">
                    {guidance.consequence}
                  </p>
                  {guidance.manager ? (
                    <p className="mt-3 text-sm font-bold text-amber-800">
                      Manager approval is required.
                    </p>
                  ) : null}
                  {guidance.printer ? (
                    <fieldset className="mt-5">
                      <legend className="flex items-center gap-2 text-sm font-bold text-[#062F24]">
                        <Printer size={16} /> What did you find?
                      </legend>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                          "One ticket printed",
                          "No ticket printed",
                          "More than one ticket printed",
                          "I am not sure",
                        ].map((answer) => (
                          <button
                            key={answer}
                            type="button"
                            aria-pressed={printerAnswer[alert.id] === answer}
                            className="min-h-12 rounded-button border border-[#062F24]/15 px-4 text-left text-sm font-semibold text-[#062F24] aria-pressed:bg-[#062F24] aria-pressed:text-white"
                            onClick={() =>
                              setPrinterAnswer((current) => ({
                                ...current,
                                [alert.id]: answer,
                              }))
                            }
                          >
                            {answer}
                          </button>
                        ))}
                      </div>
                      {printerAnswer[alert.id] ? (
                        <p className="mt-3 rounded-surface bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                          {printerAnswer[alert.id] === "One ticket printed"
                            ? "Keep the physical ticket with the order and continue in Kitchen."
                            : "Stop and ask a manager or technical support before requesting another ticket."}
                        </p>
                      ) : null}
                    </fieldset>
                  ) : null}
                  <Link
                    href={guidance.href}
                    className="mt-5 inline-flex min-h-12 items-center rounded-button bg-[#062F24] px-5 text-sm font-semibold text-white"
                  >
                    {guidance.action}
                  </Link>
                </div>
              </div>
            </AdminPanel>
          );
        })}
      </div>
    </AdminPage>
  );
}

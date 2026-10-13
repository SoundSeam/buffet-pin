"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Printer,
  RotateCcw,
  XCircle,
} from "lucide-react";

import {
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  adminButtonClass,
  adminPrimaryButtonStyle,
  adminQuietButtonStyle,
} from "@/components/admin/admin-page-ui";
import {
  diagnoseMachineTestOrder,
  type MachineTestEnvironment,
  type MachineTestOrder,
} from "@/lib/operations/machine-test";

type MachineTestData = {
  environment: MachineTestEnvironment;
  settings: {
    onlineOrderingEnabled: boolean;
    deliveryEnabled: boolean;
  };
  orders: MachineTestOrder[];
};

type TestPhase =
  | "IDLE"
  | "CONNECTING"
  | "WAITING_FOR_ORDER"
  | "TRACKING"
  | "COMPLETE"
  | "FAILED";
type PhysicalResult = "ONE" | "NONE" | "MULTIPLE" | null;

const pollMs = 3000;

export default function MachineTestPage() {
  const [data, setData] = useState<MachineTestData | null>(null);
  const [phase, setPhase] = useState<TestPhase>("IDLE");
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState("Ready to test.");
  const [physicalResult, setPhysicalResult] = useState<PhysicalResult>(null);
  const baselineOrderIds = useRef<Set<string>>(new Set());
  const startedAt = useRef<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/machine-test", {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error?.message ?? "Could not read test status.");
    setData(result.data);
    return result.data as MachineTestData;
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      setDiagnostic(error instanceof Error ? error.message : String(error)),
    );
    const interval = window.setInterval(
      () => void load().catch(() => undefined),
      pollMs,
    );
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!data || phase !== "WAITING_FOR_ORDER" || !startedAt.current) return;
    const order = data.orders.find(
      (candidate) =>
        !baselineOrderIds.current.has(candidate.id) &&
        Date.parse(candidate.createdAt) >= startedAt.current! - 2000,
    );
    if (order) {
      setTrackedOrderId(order.id);
      setPhase("TRACKING");
      setDiagnostic(
        "Test order found. Following payment, Clover, and printer status.",
      );
    } else if (Date.now() - startedAt.current > 120_000) {
      setPhase("FAILED");
      setDiagnostic(
        "No new test order appeared after two minutes. Check that checkout was completed on this same app and database.",
      );
    }
  }, [data, phase]);

  const trackedOrder = useMemo(
    () => data?.orders.find((order) => order.id === trackedOrderId) ?? null,
    [data, trackedOrderId],
  );
  const orderDiagnosis = trackedOrder
    ? diagnoseMachineTestOrder(trackedOrder)
    : null;
  const canReportPrinter = Boolean(
    trackedOrder &&
    trackedOrder.paymentStatus === "PAID" &&
    trackedOrder.cloverOrderState === "CREATED" &&
    ["SUBMITTED", "PRINTING", "PRINTED"].includes(trackedOrder.printStatus),
  );

  const reset = () => {
    baselineOrderIds.current = new Set(
      data?.orders.map((order) => order.id) ?? [],
    );
    startedAt.current = null;
    setTrackedOrderId(null);
    setPhysicalResult(null);
    setPhase("IDLE");
    setDiagnostic("Ready to test.");
  };

  const runTest = async () => {
    const current = await load().catch((error) => {
      setPhase("FAILED");
      setDiagnostic(error instanceof Error ? error.message : String(error));
      return null;
    });
    if (!current) return;

    baselineOrderIds.current = new Set(current.orders.map((order) => order.id));
    startedAt.current = Date.now();
    setTrackedOrderId(null);
    setPhysicalResult(null);
    setPhase("CONNECTING");
    setDiagnostic("Checking the app's Clover connection…");

    const response = await fetch("/api/admin/machine-test", { method: "POST" });
    const result = await response.json();
    if (!response.ok) {
      setPhase("FAILED");
      setDiagnostic(
        result.error?.message ?? "The app could not connect to Clover.",
      );
      return;
    }
    if (current.settings.onlineOrderingEnabled) {
      setPhase("FAILED");
      setDiagnostic(
        "Public online ordering is ON. Turn it OFF before this live machine test, then run again.",
      );
      return;
    }

    setPhase("WAITING_FOR_ORDER");
    const moneyWarning =
      result.data.cloverEnvironment === "production"
        ? " This is LIVE Clover, so the payment will be real."
        : "";
    setDiagnostic(
      `Connected to ${result.data.merchantName}.${moneyWarning} Open the order page and complete one small paid order.`,
    );
  };

  const reportPhysicalResult = (result: Exclude<PhysicalResult, null>) => {
    setPhysicalResult(result);
    setPhase("COMPLETE");
    if (result === "ONE") {
      setDiagnostic(
        trackedOrder?.printStatus === "PRINTED"
          ? "PASS — one paid order created one Clover order and exactly one SP700 ticket."
          : "PARTIAL PASS — exactly one ticket printed, but Clover has not confirmed the final print state yet.",
      );
    } else if (result === "NONE") {
      setDiagnostic(
        "FAIL — Clover accepted the print request, but nothing came out. Check Clover's selected order printer, then the SP700 paper, ribbon, error light, cable, and network.",
      );
    } else {
      setDiagnostic(
        "STOP — more than one ticket printed. Do not run another order until the duplicate-print cause is resolved.",
      );
    }
  };

  const visual =
    phase === "COMPLETE" &&
    physicalResult === "ONE" &&
    trackedOrder?.printStatus === "PRINTED"
      ? "PASS"
      : phase === "FAILED" ||
          (phase === "COMPLETE" && physicalResult !== "ONE") ||
          orderDiagnosis?.level === "FAIL"
        ? "FAIL"
        : phase === "COMPLETE" || orderDiagnosis?.level === "STOP"
          ? "STOP"
          : phase === "IDLE"
            ? "IDLE"
            : "RUNNING";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Clover & Printer Test"
        description="Protected installation test. One controlled order, with public ordering kept off."
      />

      <AdminPanel className="mt-8">
        <div className="flex flex-col items-center py-5 text-center sm:py-8">
          <ResultIcon result={visual} />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#062F24]/45">
            {phase.replaceAll("_", " ")}
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-extrabold leading-tight text-[#062F24]">
            {phase === "TRACKING" && orderDiagnosis
              ? orderDiagnosis.title
              : diagnostic}
          </h2>
          {phase === "TRACKING" && orderDiagnosis ? (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#062F24]/65">
              {orderDiagnosis.detail}
            </p>
          ) : null}

          {trackedOrder ? (
            <div className="mt-6 w-full max-w-xl rounded-surface bg-[rgba(6,47,36,0.04)] p-4">
              <div className="text-lg font-extrabold text-[#062F24]">
                {trackedOrder.orderNumber}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Status
                  label="Payment"
                  value={trackedOrder.paymentStatus}
                  good="PAID"
                />
                <Status
                  label="Clover"
                  value={trackedOrder.cloverOrderState}
                  good="CREATED"
                />
                <Status
                  label="Printer"
                  value={trackedOrder.printStatus}
                  good="PRINTED"
                />
              </div>
            </div>
          ) : null}

          {canReportPrinter && phase !== "COMPLETE" ? (
            <div className="mt-7 w-full max-w-xl border-t border-[#062F24]/10 pt-6">
              <p className="font-extrabold text-[#062F24]">
                What came out of the SP700?
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  className={adminButtonClass}
                  style={adminPrimaryButtonStyle}
                  onClick={() => reportPhysicalResult("ONE")}
                >
                  One ticket
                </button>
                <button
                  type="button"
                  className={adminButtonClass}
                  style={adminQuietButtonStyle}
                  onClick={() => reportPhysicalResult("NONE")}
                >
                  Nothing
                </button>
                <button
                  type="button"
                  className={adminButtonClass}
                  style={adminQuietButtonStyle}
                  onClick={() => reportPhysicalResult("MULTIPLE")}
                >
                  More than one
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {phase === "IDLE" || phase === "FAILED" ? (
              <button
                type="button"
                className={adminButtonClass}
                style={adminPrimaryButtonStyle}
                onClick={() => void runTest()}
              >
                <Printer size={16} /> Run live test
              </button>
            ) : null}
            {phase === "WAITING_FOR_ORDER" ? (
              <Link
                className={adminButtonClass}
                style={adminPrimaryButtonStyle}
                href="/order"
                target="_blank"
              >
                Open order page <ExternalLink size={14} />
              </Link>
            ) : null}
            {phase !== "IDLE" ? (
              <button
                type="button"
                className={adminButtonClass}
                style={adminQuietButtonStyle}
                onClick={reset}
              >
                <RotateCcw size={15} /> Reset
              </button>
            ) : null}
          </div>
        </div>
      </AdminPanel>

      {phase === "IDLE" && data ? (
        <p className="mt-4 text-center text-sm font-extrabold text-red-800">
          LIVE CLOVER ONLY — one real charge and one SP700 ticket ·{" "}
          {data.environment.merchantHint ?? "merchant not configured"}
        </p>
      ) : null}
    </AdminPage>
  );
}

function ResultIcon({
  result,
}: {
  result: "IDLE" | "RUNNING" | "PASS" | "FAIL" | "STOP";
}) {
  const iconClass =
    result === "PASS"
      ? "bg-emerald-100 text-emerald-700"
      : result === "FAIL" || result === "STOP"
        ? "bg-red-100 text-red-700"
        : "bg-[rgba(6,47,36,0.06)] text-[#062F24]";
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full ${iconClass}`}
    >
      {result === "PASS" ? (
        <CheckCircle2 size={34} />
      ) : result === "FAIL" ? (
        <XCircle size={34} />
      ) : result === "STOP" ? (
        <CircleAlert size={34} />
      ) : result === "RUNNING" ? (
        <Loader2 className="animate-spin" size={32} />
      ) : (
        <Printer size={32} />
      )}
    </div>
  );
}

function Status({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: string;
}) {
  const isGood = value === good;
  const isBad = [
    "FAILED",
    "UNKNOWN",
    "TOTAL_MISMATCH",
    "NO PRINT INTENT",
  ].includes(value);
  const friendlyValue =
    label === "Payment"
      ? ((
          {
            PENDING: "Waiting",
            PAID: "Paid",
            FAILED: "Failed",
            REFUNDED: "Refunded",
            PARTIALLY_REFUNDED: "Partly refunded",
          } as Record<string, string>
        )[value] ?? value)
      : label === "Clover"
        ? ((
            {
              "NOT CREATED": "Not created",
              PENDING: "Sending",
              CREATED: "Order created",
              FAILED: "Failed",
              UNKNOWN: "Unknown",
              TOTAL_MISMATCH: "Total mismatch",
            } as Record<string, string>
          )[value] ?? value)
        : ((
            {
              "NO PRINT INTENT": "No print request",
              PENDING: "Queued",
              SUBMITTING: "Sending",
              SUBMITTED: "Sent to Clover",
              PRINTING: "Printing",
              PRINTED: "Printed",
              FAILED: "Failed",
              UNKNOWN: "Unknown",
            } as Record<string, string>
          )[value] ?? value);
  return (
    <div className="min-w-0 rounded-button bg-white px-2 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#062F24]/45">
        {label}
      </div>
      <div
        className={`mt-1 break-words text-xs font-extrabold ${isGood ? "text-emerald-700" : isBad ? "text-red-700" : "text-amber-700"}`}
      >
        {friendlyValue}
      </div>
    </div>
  );
}

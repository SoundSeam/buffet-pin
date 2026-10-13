import { PrintJobStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CloverApiError } from "../../lib/clover/client";
import { classifyPrintSubmissionError } from "../../lib/clover/print-orders";

describe("Clover print submission classification", () => {
  it.each([400, 401, 403, 404, 422])("classifies deterministic HTTP %s rejection as failed", (status) => {
    expect(classifyPrintSubmissionError(new CloverApiError("rejected", status, {}))).toBe(PrintJobStatus.FAILED);
  });
  it.each([408, 409, 429, 500])("classifies ambiguous HTTP %s response as unknown", (status) => {
    expect(classifyPrintSubmissionError(new CloverApiError("ambiguous", status, {}))).toBe(PrintJobStatus.UNKNOWN);
  });
  it("classifies transport errors as unknown", () => {
    expect(classifyPrintSubmissionError(new Error("timeout"))).toBe(PrintJobStatus.UNKNOWN);
  });
});

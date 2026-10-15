import { describe, expect, it } from "vitest";
import { assertCleanAudit } from "../../scripts/security-audit.mjs";

const clean = () => ({ vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
const result = (report: unknown, status: number | null = 0) => ({ status, stdout: JSON.stringify(report) });

describe("dependency security acceptance", () => {
  it("accepts only a complete zero-finding audit", () => expect(() => assertCleanAudit(result(clean()))).not.toThrow());
  it.each(["info", "low", "moderate", "high", "critical", "total"])("rejects %s findings even with npm exit zero", (severity) => {
    const report = clean(); report.metadata.vulnerabilities[severity as keyof typeof report.metadata.vulnerabilities] = 1;
    expect(() => assertCleanAudit(result(report))).toThrow("not clean");
  });
  it("rejects registry failures and malformed/incomplete reports", () => {
    for (const value of [result(clean(), 1), result(clean(), null), { status: 0, stdout: "registry unavailable" }, result({}), result({ ...clean(), error: { code: "E503" } }), result({ ...clean(), vulnerabilities: { hidden: {} } })]) {
      expect(() => assertCleanAudit(value)).toThrow();
    }
  });
});

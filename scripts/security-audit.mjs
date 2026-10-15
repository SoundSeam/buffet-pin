import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Exit codes/thresholds alone can miss moderate findings or registry failures.
export function assertCleanAudit(result) {
  if (result.error || result.status !== 0) throw new Error("Dependency audit failed; findings or registry errors must be resolved.");
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error("Dependency audit did not return valid JSON."); }
  const counts = report.metadata?.vulnerabilities;
  if (report.error || !counts || typeof report.vulnerabilities !== "object" || report.vulnerabilities === null || Array.isArray(report.vulnerabilities)) throw new Error("Dependency audit report is incomplete.");
  for (const key of ["info", "low", "moderate", "high", "critical", "total"]) {
    if (counts[key] !== 0) throw new Error(`Dependency audit is not clean: ${key}=${counts[key] ?? "missing"}.`);
  }
  if (Object.keys(report.vulnerabilities).length) throw new Error("Dependency audit contains affected packages.");
  return report;
}

export function runAudit(mode) {
  if (!["--production", "--full"].includes(mode)) throw new Error("Use exactly --production or --full.");
  const args = ["audit", "--json", "--audit-level=low", ...(mode === "--production" ? ["--omit=dev"] : [])];
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assertCleanAudit(result);
  process.stdout.write(`Dependency audit ${mode}: zero findings at every severity.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Use exactly --production or --full.");
    runAudit(process.argv[2]);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

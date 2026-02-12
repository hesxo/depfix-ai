import { Command, Flags } from "@oclif/core";
import { runNpmAuditJson } from "../lib/audit/npmAudit.js";
import type { Severity } from "../lib/audit/summarize.js";
import {
  AuditSummaryOptions,
  printAuditSummary,
  summarizeNpmAudit,
} from "../lib/audit/summarize.js";
import { logError, logInfo } from "../lib/ui/log.js";

function normalizeSeverity(s: string | undefined): Severity {
  if (s && ["low", "moderate", "high", "critical"].includes(s)) return s as Severity;
  return "low";
}

export default class Audit extends Command {
  static readonly id = "audit";
  static readonly description =
    "Audit dependencies and summarize vulnerabilities (npm and pnpm).";

  static readonly flags = {
    json: Flags.boolean({
      description: "Print raw npm audit JSON to stdout",
    }),
    severity: Flags.string({
      description: "Minimum severity to include",
      options: ["low", "moderate", "high", "critical"],
      default: "low",
    }),
    fail: Flags.boolean({
      description: "Exit with code 1 if vulnerabilities at or above --severity exist",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Audit);
    const severity = normalizeSeverity(flags.severity);

    const { pm, rawJson, exitCode } = await runNpmAuditJson();

    if (pm !== "npm") {
      logInfo(`Audit is only implemented for npm right now. Detected ${pm}.`);
      return;
    }

    if (!rawJson) {
      logError("npm audit did not return JSON output.");
      if (typeof exitCode === "number") this.exit(exitCode);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      logError("Failed to parse npm audit JSON output.");
      if (flags.json) console.log(rawJson);
      if (typeof exitCode === "number") this.exit(exitCode);
      return;
    }

    const summaryOptions: AuditSummaryOptions = { minSeverity: severity };
    const summary = summarizeNpmAudit(parsed, summaryOptions);

    printAuditSummary(summary);

    if (flags.json) console.log(rawJson);

    if (flags.fail) {
      const hasIssues =
        summary.counts.critical > 0 ||
        (severity !== "critical" && summary.counts.high > 0) ||
        (["low", "moderate"].includes(severity) && summary.counts.moderate > 0) ||
        (severity === "low" && summary.counts.low > 0);
      if (hasIssues) this.exit(1);
    }
  }
}

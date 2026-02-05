import { runNpmAuditJson } from "../lib/audit/npmAudit";
import {
  AuditSummaryOptions,
  Severity,
  printAuditSummary,
  summarizeNpmAudit,
} from "../lib/audit/summarize";
import { logError, logInfo } from "../lib/ui/log";

export interface AuditFlags {
  json: boolean;
  severity?: Severity;
  fail: boolean;
}

function parseArgs(argv: string[]): AuditFlags {
  const flags: AuditFlags = {
    json: false,
    fail: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--json":
        flags.json = true;
        break;
      case "--severity": {
        const value = argv[i + 1] as Severity | undefined;
        if (value && ["low", "moderate", "high", "critical"].includes(value)) {
          flags.severity = value;
          i++;
        } else {
          logError("Invalid value for --severity. Use one of: low, moderate, high, critical.");
        }
        break;
      }
      case "--fail":
        flags.fail = true;
        break;
      default:
        logError(`Unknown flag or argument: ${arg}`);
        break;
    }
  }

  return flags;
}

export async function runAuditCommand(argv: string[] = []) {
  const flags = parseArgs(argv);
  const severity: Severity = flags.severity ?? "low";

  const { pm, rawJson, exitCode } = await runNpmAuditJson();

  if (pm !== "npm") {
    logInfo(`Audit is only implemented for npm right now. Detected ${pm}.`);
    return;
  }

  if (!rawJson) {
    logError("npm audit did not return JSON output.");
    if (typeof exitCode === "number") {
      process.exitCode = exitCode;
    }
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    logError("Failed to parse npm audit JSON output.");
    if (flags.json) {
      // Still honour the request for raw output.
      // eslint-disable-next-line no-console
      console.log(rawJson);
    }
    if (typeof exitCode === "number") {
      process.exitCode = exitCode;
    }
    return;
  }

  const summaryOptions: AuditSummaryOptions = { minSeverity: severity };
  const summary = summarizeNpmAudit(parsed, summaryOptions);

  printAuditSummary(summary);

  if (flags.json) {
    // eslint-disable-next-line no-console
    console.log(rawJson);
  }

  if (flags.fail) {
    const hasIssuesAboveThreshold =
      summary.counts.critical > 0 ||
      (severity !== "critical" && summary.counts.high > 0) ||
      (["low", "moderate"].includes(severity) && summary.counts.moderate > 0) ||
      (severity === "low" && summary.counts.low > 0);

    if (hasIssuesAboveThreshold) {
      process.exitCode = 1;
    }
  }
}


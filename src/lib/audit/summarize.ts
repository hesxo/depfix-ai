import { logInfo } from "../ui/log";

export type Severity = "low" | "moderate" | "high" | "critical";

export interface AuditSummaryOptions {
  /**
   * Minimum severity to include in the summary.
   * Vulnerabilities below this level will be ignored.
   */
  minSeverity?: Severity;
}

export interface SeverityCounts {
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

export interface PackageImpact {
  name: string;
  count: number;
}

export interface AuditSummary {
  counts: SeverityCounts;
  impactedPackages: PackageImpact[];
}

const severityOrder: Severity[] = ["low", "moderate", "high", "critical"];

function severityAtLeast(a: Severity, min: Severity): boolean {
  return severityOrder.indexOf(a) >= severityOrder.indexOf(min);
}

function emptyCounts(): SeverityCounts {
  return { low: 0, moderate: 0, high: 0, critical: 0 };
}

/**
 * Normalise npm audit JSON into a simple summary that is reasonably
 * robust across npm versions (v6/v7+).
 */
export function summarizeNpmAudit(
  data: unknown,
  options: AuditSummaryOptions = {},
): AuditSummary {
  const minSeverity = options.minSeverity ?? "low";
  const counts = emptyCounts();
  const pkgCounts = new Map<string, number>();

  const anyData = data as any;

  // Prefer the modern `vulnerabilities` shape if present.
  if (anyData && typeof anyData === "object" && anyData.vulnerabilities) {
    const vulns = anyData.vulnerabilities as Record<string, any>;
    for (const [pkgName, vuln] of Object.entries(vulns)) {
      const severity = vuln.severity as Severity | undefined;
      if (!severity || !severityAtLeast(severity, minSeverity)) continue;

      counts[severity] += 1;
      pkgCounts.set(pkgName, (pkgCounts.get(pkgName) ?? 0) + 1);
    }
  } else if (anyData && typeof anyData === "object" && anyData.advisories) {
    // Legacy npm audit format with `advisories`.
    const advisories = anyData.advisories as Record<string, any>;
    for (const adv of Object.values(advisories)) {
      const severity = (adv as any).severity as Severity | undefined;
      const moduleName = (adv as any).module_name as string | undefined;
      if (!severity || !moduleName || !severityAtLeast(severity, minSeverity)) continue;

      counts[severity] += 1;
      pkgCounts.set(moduleName, (pkgCounts.get(moduleName) ?? 0) + 1);
    }
  } else if (anyData && anyData.metadata && anyData.metadata.vulnerabilities) {
    // Fallback: just lift counts from metadata if available.
    const metaCounts = anyData.metadata.vulnerabilities as Partial<SeverityCounts>;
    for (const sev of severityOrder) {
      const value = metaCounts[sev];
      if (typeof value === "number" && severityAtLeast(sev, minSeverity)) {
        counts[sev] += value;
      }
    }
  }

  const impactedPackages: PackageImpact[] = Array.from(pkgCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { counts, impactedPackages };
}

export function printAuditSummary(summary: AuditSummary) {
  const { counts, impactedPackages } = summary;

  logInfo("Vulnerability summary:");
  logInfo(
    `  low: ${counts.low}, moderate: ${counts.moderate}, high: ${counts.high}, critical: ${counts.critical}`,
  );

  if (impactedPackages.length > 0) {
    logInfo("Top affected packages:");
    for (const pkg of impactedPackages) {
      logInfo(`  ${pkg.name}: ${pkg.count} issue(s)`);
    }
  } else {
    logInfo("No vulnerable packages found at or above the selected severity.");
  }

  logInfo("What to do next:");
  logInfo("  - Run `npm audit fix` to apply safe automatic fixes.");
  logInfo(
    "  - For remaining issues, review advisories and consider upgrading major versions or replacing packages.",
  );
  logInfo(
    "  - If you cannot upgrade immediately, consider using overrides/resolutions with care and track them for cleanup.",
  );
}

// Temporary placeholder to keep the existing `fix` command wired up.
// This can later be replaced with a real remediation flow.
export async function runFix() {
  logInfo("Running depfix-ai fix (not implemented yet).");
}



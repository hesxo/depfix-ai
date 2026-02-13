import type { PackageManager } from "../pm/types.js";
import { detectPackageManager } from "../pm/detect.js";
import { runPmCommand } from "../pm/run.js";

export interface NpmAuditResult {
  pm: PackageManager;
  rawJson: string | undefined;
  exitCode: number | undefined;
}

function extractJson(stdout: string | undefined, stderr: string | undefined): string | undefined {
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  if (!combined?.trim()) return undefined;

  const trimmed = combined.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  if (start >= 0) {
    const end = trimmed.lastIndexOf("}") + 1;
    if (end > start) return trimmed.slice(start, end);
  }

  // Yarn may output JSON-lines; use last line with metadata
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().startsWith("{"));
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i]!.trim();
    if (candidate.includes("metadata") || candidate.includes("advisories") || candidate.includes("vulnerabilities")) {
      return candidate;
    }
  }
  return lines[lines.length - 1]?.trim();
}

const AUDIT_ARGS: Record<PackageManager, string[]> = {
  npm: ["audit", "--json"],
  pnpm: ["audit", "--json"],
  yarn: ["audit", "--json"],
  bun: ["audit", "--json"],
};

/**
 * Run audit in JSON mode for npm, pnpm, yarn, or bun.
 * Captures JSON from stdout or stderr.
 */
export async function runNpmAuditJson(cwd = process.cwd()): Promise<NpmAuditResult> {
  const pm = detectPackageManager(cwd);
  const args = AUDIT_ARGS[pm] ?? ["audit", "--json"];
  const { stdout, stderr, exitCode } = await runPmCommand(pm, args, { cwd });
  const rawJson = extractJson(stdout, stderr);

  return { pm, rawJson, exitCode };
}


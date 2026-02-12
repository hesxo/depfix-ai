import { detectPackageManager } from "../pm/detect.js";
import { runPmCommand } from "../pm/run.js";

export interface NpmAuditResult {
  pm: "npm" | string;
  rawJson: string | undefined;
  exitCode: number | undefined;
}

/**
 * Run an audit in JSON mode.
 *
 * Supports npm and pnpm. Both output JSON compatible with our summarize logic.
 */
export async function runNpmAuditJson(cwd = process.cwd()): Promise<NpmAuditResult> {
  const pm = detectPackageManager(cwd);

  if (pm !== "npm" && pm !== "pnpm") {
    return { pm, rawJson: undefined, exitCode: undefined };
  }

  const { stdout, stderr, exitCode } = await runPmCommand(pm, ["audit", "--json"], {
    cwd,
  });

  // pnpm may send JSON to stderr when exitCode is non-zero
  const rawJson = stdout?.trim() || stderr?.trim();
  return {
    pm,
    rawJson: rawJson || undefined,
    exitCode,
  };
}


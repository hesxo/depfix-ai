import { detectPackageManager } from "../pm/detect.js";
import { runPmCommand } from "../pm/run.js";

export interface NpmAuditResult {
  pm: "npm" | string;
  rawJson: string | undefined;
  exitCode: number | undefined;
}

/**
 * Run an npm audit in JSON mode.
 *
 * For v0.1.0 we only support npm; if another package manager
 * is detected we return early without running anything.
 */
export async function runNpmAuditJson(cwd = process.cwd()): Promise<NpmAuditResult> {
  const pm = detectPackageManager(cwd);

  if (pm !== "npm") {
    return { pm, rawJson: undefined, exitCode: undefined };
  }

  const { stdout, exitCode } = await runPmCommand(pm, ["audit", "--json"], {
    cwd,
  });

  return {
    pm,
    rawJson: stdout,
    exitCode,
  };
}


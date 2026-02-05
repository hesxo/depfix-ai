import { execa } from "execa";
import { PackageManager, RunOptions, RunResult } from "./types.js";

export async function runPmCommand(
  pm: PackageManager,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { stdout, stderr, exitCode } = await execa(pm, args, {
    cwd: options.cwd,
    stdio: options.stdio ?? "pipe",
    // Never throw on non‑zero exit codes; always resolve with the result.
    reject: false,
  });

  return { stdout, stderr, exitCode };
}


import { execa } from "execa";
import { PackageManager, RunOptions, RunResult } from "./types";

export async function runPmCommand(
  pm: PackageManager,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const { stdout, stderr, exitCode } = await execa(pm, args, {
    cwd: options.cwd,
    stdio: options.stdio ?? "pipe",
  });

  return { stdout, stderr, exitCode };
}


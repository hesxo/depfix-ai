export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface RunOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe";
}

export interface RunResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}


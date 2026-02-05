import { execa } from "execa";

/**
 * Return git diff output for the given paths (e.g. package.json, package-lock.json).
 * Used for fix preview before applying changes.
 */
export async function gitDiff(paths: string[] = [], cwd = process.cwd()): Promise<string> {
  const args = ["diff", "--no-color"];
  if (paths.length > 0) args.push("--", ...paths);
  const { stdout } = await execa("git", args, { cwd });
  return stdout;
}

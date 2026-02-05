import { PackageManager } from "./types.js";
import fs from "node:fs";
import path from "node:path";

export function detectPackageManager(cwd = process.cwd()): PackageManager {
  // Priority:
  // 1. pnpm (pnpm-lock.yaml)
  // 2. yarn (yarn.lock)
  // 3. npm (package-lock.json)
  // 4. bun (bun.lockb)
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(cwd, "package-lock.json"))) return "npm";
  if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";

  // Fallback to npm if no known lockfile is present.
  return "npm";
}


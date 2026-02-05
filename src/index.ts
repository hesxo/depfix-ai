/**
 * Programmatic entry; CLI entry is bin/run.js (oclif).
 * Export version for consumers.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { version?: string };

export const version = pkg.version ?? "0.0.0";

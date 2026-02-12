#!/usr/bin/env node
/**
 * Always run the latest depfix-ai (bypasses npx cache).
 * Usage: npx depfix-ai-latest    or    npx depfix-ai@latest
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const result = spawnSync("npx", ["depfix-ai@latest", ...args], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);

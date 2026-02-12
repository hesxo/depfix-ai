#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { execute } from "@oclif/core";

// No subcommand → interactive menu
if (!process.argv[2]) {
  try {
    const { runInteractive } = await import(
      new URL("../dist/ui/interactive.js", import.meta.url).href
    );
    await runInteractive();
    process.exit(process.exitCode ?? 0);
  } catch (err) {
    const code = err?.code;
    if (code === "ERR_MODULE_NOT_FOUND" || err?.message?.includes("Cannot find module")) {
      // Old/cached version - run latest instead
      const result = spawnSync("npx", ["depfix-ai@latest"], {
        stdio: "inherit",
        shell: true,
      });
      process.exit(result.status ?? 1);
    }
    console.error("\x1b[31m✗\x1b[0m depfix-ai Interactive menu failed:", err?.message ?? err);
    process.exit(1);
  }
}

await execute({ dir: import.meta.url });

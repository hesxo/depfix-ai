#!/usr/bin/env node

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
    console.error("Interactive menu failed:", err);
    process.exit(1);
  }
}

await execute({ dir: import.meta.url });

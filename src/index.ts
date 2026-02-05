#!/usr/bin/env node

import { runAuditCommand } from "./commands/audit";
import { runFix } from "./lib/audit/summarize";
import { runEnvGenerate } from "./lib/env/write";
import { runOnboard } from "./lib/safety/backup";
import { logInfo, logError } from "./lib/ui/log";

export async function main(argv = process.argv.slice(2)) {
  const [command, subcommand, ...rest] = argv;

  try {
    switch (command) {
      case "audit":
        await runAuditCommand(rest);
        break;
      case "fix":
        await runFix();
        break;
      case "env":
        if (subcommand === "generate") {
          await runEnvGenerate(rest);
        } else {
          logError('Usage: depfix-ai env generate');
        }
        break;
      case "onboard":
        await runOnboard();
        break;
      default:
        logInfo("depfix-ai CLI");
        logInfo("Available commands:");
        logInfo("  audit");
        logInfo("  fix");
        logInfo("  env generate");
        logInfo("  onboard");
        break;
    }
  } catch (err) {
    logError("Unexpected error", err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

import { logInfo } from "../ui/log.js";

export function startDryRun() {
  logInfo("Starting dry run (no changes will be written).");
}

export function endDryRun() {
  logInfo("Finished dry run.");
}


import { logInfo } from "../ui/log";

export function startDryRun() {
  logInfo("Starting dry run (no changes will be written).");
}

export function endDryRun() {
  logInfo("Finished dry run.");
}


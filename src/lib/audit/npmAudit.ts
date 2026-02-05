import { detectPackageManager } from "../pm/detect";
import { runPmCommand } from "../pm/run";
import { logInfo } from "../ui/log";

export async function runAudit() {
  const pm = detectPackageManager();
  logInfo(`Running security audit with ${pm}...`);

  if (pm !== "npm") {
    logInfo(`Audit is only implemented for npm right now. Detected ${pm}.`);
    return;
  }

  const result = await runPmCommand(pm, ["audit", "--json"]);
  logInfo(result.stdout || "npm audit completed.");
}


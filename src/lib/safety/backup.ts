import { gitStashSave } from "../git/stash";
import { logInfo } from "../ui/log";

export async function runOnboard() {
  logInfo("Onboarding project with depfix-ai (minimal stub).");
  await gitStashSave("depfix-ai onboarding backup");
  logInfo("Created git stash as a safety backup.");
}


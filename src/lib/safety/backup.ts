import { gitStashSave } from "../git/stash.js";
import { logInfo } from "../ui/log.js";

export interface OnboardFlags {
  skipInstall: boolean;
  skipEnv: boolean;
  skipTest: boolean;
}

export async function runOnboard(opts: Partial<OnboardFlags> = {}) {
  const skipInstall = opts.skipInstall ?? false;
  const skipEnv = opts.skipEnv ?? false;
  const skipTest = opts.skipTest ?? false;

  logInfo("Onboarding project with depfix-ai (minimal stub).");
  if (skipInstall) logInfo("Will skip install (--skip-install).");
  if (skipEnv) logInfo("Will skip env generate (--skip-env).");
  if (skipTest) logInfo("Will skip tests (--skip-test).");

  await gitStashSave("depfix-ai onboarding backup");
  logInfo("Created git stash as a safety backup.");
}


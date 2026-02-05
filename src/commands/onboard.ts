import { Command, Flags } from "@oclif/core";
import { runOnboard } from "../lib/safety/backup.js";

export default class Onboard extends Command {
  static readonly id = "onboard";
  static readonly description =
    "Run contributor onboarding: install deps, generate env, run tests.";

  static readonly flags = {
    "skip-install": Flags.boolean({
      description: "Skip dependency install",
    }),
    "skip-env": Flags.boolean({
      description: "Skip env generate",
    }),
    "skip-test": Flags.boolean({
      description: "Skip test script",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Onboard);
    await runOnboard({
      skipInstall: flags["skip-install"],
      skipEnv: flags["skip-env"],
      skipTest: flags["skip-test"],
    });
  }
}

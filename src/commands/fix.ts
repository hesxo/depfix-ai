import { Command, Flags } from "@oclif/core";
import { runFix } from "../lib/audit/summarize.js";

export default class Fix extends Command {
  static readonly id = "fix";
  static readonly description =
    "Preview and apply dependency fixes safely (dry-run by default).";

  static readonly flags = {
    apply: Flags.boolean({
      description: "Actually apply changes (default: dry-run only)",
    }),
    force: Flags.boolean({
      description: "Pass --force to npm audit fix",
    }),
    stash: Flags.boolean({
      description: "Auto-stash if git working tree is dirty",
    }),
    commit: Flags.boolean({
      description: "Auto-commit changes with chore(deps): audit fix",
    }),
    "dry-run": Flags.boolean({
      description: "Preview only; do not write files (default: true)",
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Fix);
    // v0.1: placeholder; full implementation will use dry-run default, backups, diff preview
    if (flags["dry-run"] !== false && !flags.apply) {
      this.log("Dry-run: no changes will be written. Use --apply to apply fixes.");
    }
    await runFix();
  }
}

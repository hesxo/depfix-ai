import { Command, Flags } from "@oclif/core";
import { runEnvGenerate } from "../../lib/env/write.js";

export default class EnvGenerate extends Command {
  static readonly id = "env:generate";
  static readonly description =
    "Generate .env.example from detected environment variable usage in source.";

  static readonly flags = {
    out: Flags.string({
      description: "Output path for example file",
      default: ".env.example",
    }),
    create: Flags.boolean({
      description: "Create .env with blank values if missing",
    }),
    force: Flags.boolean({
      description: "Overwrite existing outputs (e.g. .env when used with --create)",
    }),
    check: Flags.boolean({
      description: "Verify .env.example contains all required vars; exit 1 if not",
    }),
    ai: Flags.boolean({
      description: "Use OpenAI to add descriptions and where-to-get for each variable",
      default: false,
    }),
    model: Flags.string({
      description: "OpenAI model for AI mode (e.g. gpt-4o-mini)",
      default: "gpt-4o-mini",
    }),
    "api-key": Flags.string({
      description: "OpenAI API key (default: OPENAI_API_KEY env)",
      env: "OPENAI_API_KEY",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(EnvGenerate);
    await runEnvGenerate({
      out: flags.out,
      create: flags.create,
      force: flags.force,
      check: flags.check,
      ai: flags.ai,
      model: flags.model,
      apiKey: flags["api-key"] ?? "",
    });
  }
}

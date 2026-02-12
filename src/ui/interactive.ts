import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { intro, select, confirm, password, isCancel, cancel, spinner } from "@clack/prompts";
import pc from "picocolors";
import { execute } from "@oclif/core";
import { config as dotenvConfig } from "dotenv";
import { version } from "../index.js";
import { detectPackageManager } from "../lib/pm/detect.js";
import { runEnvGenerate } from "../lib/env/write.js";
import type { EnvAiOptions } from "../lib/env/ai.js";
import { runOnboard } from "../lib/safety/backup.js";
import { runNpmAuditJson } from "../lib/audit/npmAudit.js";
import {
  summarizeNpmAudit,
  printAuditSummary,
  writeAuditReport,
} from "../lib/audit/summarize.js";
import { logError, logInfo, logSuccess } from "../lib/ui/log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** depfix-ai package root (for bin URL) */
function getPackageRoot(): string {
  return join(__dirname, "..", "..");
}

function getBinRunUrl(): string {
  return pathToFileURL(join(getPackageRoot(), "bin", "run.js")).href;
}

/** User's project directory (where npx was run) */
function getProjectCwd(): string {
  return process.cwd();
}

function getProjectName(): string {
  const root = getProjectCwd();
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return "this project";
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    return pkg.name ?? "this project";
  } catch {
    return "this project";
  }
}

async function getGitUserFullName(): Promise<string> {
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("git", ["config", "user.name"], {
      cwd: getProjectCwd(),
      reject: false,
    });
    return stdout?.trim() ?? "there";
  } catch {
    return "there";
  }
}

async function getGitBranch(): Promise<string> {
  try {
    const { execa } = await import("execa");
    const { stdout } = await execa("git", ["branch", "--show-current"], {
      cwd: getProjectCwd(),
      reject: false,
    });
    return stdout?.trim() ? `(on ${stdout.trim()})` : "";
  } catch {
    return "";
  }
}

async function runAuditWithReport(): Promise<void> {
  const cwd = getProjectCwd();
  const { pm, rawJson } = await runNpmAuditJson(cwd);

  if (pm !== "npm" && pm !== "pnpm") {
    logInfo(`Audit is only implemented for npm and pnpm. Detected ${pm}.`);
    return;
  }

  if (!rawJson) {
    logError("npm audit did not return JSON output.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    logError("Failed to parse npm audit JSON output.");
    return;
  }

  const summary = summarizeNpmAudit(parsed, { minSeverity: "low" });
  printAuditSummary(summary);

  const save = await confirm({
    message: "📁 Save audit report to audit-report.md?",
    initialValue: false,
  });

  if (save) {
    const reportPath = join(cwd, "audit-report.md");
    await writeAuditReport(summary, reportPath);
    logSuccess(`Wrote audit report to ${reportPath}`);
  }
}

async function runEnvGenerateFlow(): Promise<void> {
  const mode = await select({
    message: "📄 How would you like to generate .env.example?",
    options: [
      { value: "default", label: "Default (fast) – variable names only" },
      { value: "ai", label: "AI-assisted – descriptions + example values (requires API key)" },
    ],
  });

  if (isCancel(mode)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  let aiOptions: EnvAiOptions | undefined;

  if (mode === "ai") {
    const provider = await select({
      message: "🤖 Select AI provider",
      options: [
        { value: "openai", label: "OpenAI (GPT-4o, GPT-3.5)" },
        { value: "google", label: "Google AI (Gemini)" },
      ],
    });

    if (isCancel(provider)) {
      cancel("Cancelled.");
      process.exit(0);
    }

    dotenvConfig({ path: join(getProjectCwd(), ".env") });

    let model: string;
    let apiKey: string;

    if (provider === "openai") {
      const modelChoice = await select({
        message: "🤖 Select model",
        options: [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-4o-mini", label: "GPT-4o Mini" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
        ],
      });
      if (isCancel(modelChoice)) {
        cancel("Cancelled.");
        process.exit(0);
      }
      model = modelChoice as string;
      const keyInput = await password({
        message: "🔑 OpenAI API key (or leave blank to use OPENAI_API_KEY from env)",
        validate: () => undefined,
      });
      if (isCancel(keyInput)) {
        cancel("Cancelled.");
        process.exit(0);
      }
      apiKey = (keyInput && typeof keyInput === "string" ? keyInput : process.env.OPENAI_API_KEY) ?? "";
      if (!apiKey) {
        logError("OpenAI API key is required for AI-assisted env generation.");
        return;
      }
    } else {
      const modelChoice = await select({
        message: "🤖 Select model",
        options: [
          { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
          { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
          { value: "gemini-1.0-pro", label: "Gemini 1.0 Pro" },
        ],
      });
      if (isCancel(modelChoice)) {
        cancel("Cancelled.");
        process.exit(0);
      }
      model = modelChoice as string;
      const keyInput = await password({
        message: "🔑 Google AI API key (or leave blank to use GOOGLE_API_KEY from env)",
        validate: () => undefined,
      });
      if (isCancel(keyInput)) {
        cancel("Cancelled.");
        process.exit(0);
      }
      apiKey = (keyInput && typeof keyInput === "string" ? keyInput : process.env.GOOGLE_API_KEY) ?? "";
      if (!apiKey) {
        logError("Google API key is required for AI-assisted env generation.");
        return;
      }
    }

    aiOptions = { provider: provider as "openai" | "google", model, apiKey };
  }

  if (aiOptions) {
    const s = spinner();
    s.start("Generating .env.example with AI (descriptions + examples)...");
    try {
      await runEnvGenerate({ out: ".env.example", ai: aiOptions });
      s.stop("Done.");
    } catch (err) {
      s.stop("Failed.");
      logError(String(err));
    }
  } else {
    await runEnvGenerate({ out: ".env.example" });
  }
}

export async function runInteractive(): Promise<void> {
  const cwd = getProjectCwd();
  dotenvConfig({ path: join(cwd, ".env") });

  const [userName, branch, pm, projectName] = await Promise.all([
    getGitUserFullName(),
    getGitBranch(),
    Promise.resolve(detectPackageManager(cwd)),
    Promise.resolve(getProjectName()),
  ]);

  const branchPart = branch ? ` ${pc.gray(branch)}` : "";
  const lines = [
    pc.bold(pc.cyan(`┌  depfix-ai  v${version}`)),
    pc.cyan(`👋 Hello, ${userName}${branchPart}`),
    pc.gray("Audit deps · Fix vulnerabilities · Generate env templates · Onboard contributors"),
    pc.cyan(`🔧 Package manager: `) + pc.gray(pm),
    pc.cyan(`📦 Project: `) + pc.gray(` ${projectName}  (package.json)`),
  ];

  intro(lines.join("\n"));

  const choice = await select({
    message: "What would you like to do?",
    options: [
      { value: "audit", label: "🔍 Audit" },
      { value: "env", label: "📄 Env generate" },
      { value: "onboard", label: "👥 Onboard" },
      { value: "fix", label: "🔧 Fix" },
      { value: "quit", label: "🚪 Quit" },
    ],
  });

  if (choice === "quit") {
    process.exit(0);
  }

  if (choice === "audit") {
    await runAuditWithReport();
    return;
  }

  if (choice === "env") {
    await runEnvGenerateFlow();
    return;
  }

  if (choice === "onboard") {
    await runOnboard({});
    return;
  }

  if (choice === "fix") {
    await execute({
      dir: getBinRunUrl(),
      args: ["fix"],
    });
    return;
  }

  process.exit(0);
}

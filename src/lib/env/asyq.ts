#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import pc from "picocolors";

import { scanProjectForEnvKeys } from "./scan.js";
import {
  generateEnvDocsWithOpenAI,
  generateEnvDocsWithGoogle,
} from "./ai.js";

const MODELS_OPENAI = [
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.2-pro",
  "gpt-5-pro",
  "gpt-4.1",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
] as const;

const MODELS_GOOGLE = [
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.0-pro",
] as const;

type Provider = "openai" | "google";
type OpenAIModel = (typeof MODELS_OPENAI)[number];
type GoogleModel = (typeof MODELS_GOOGLE)[number];

function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function fail(message: string): never {
  p.outro(pc.red(message));
  process.exit(1);
}

async function pickMode(): Promise<"default" | "ai"> {
  const mode = await p.select({
    message: "How would you like to generate .env.example?",
    options: [
      { label: "Default (fast)", value: "default" },
      { label: "AI-assisted (adds descriptions)", value: "ai" },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return mode as "default" | "ai";
}

async function pickProvider(): Promise<Provider> {
  const provider = await p.select({
    message: "Select AI provider",
    options: [
      { label: "OpenAI (GPT-4, GPT-5)", value: "openai" },
      { label: "Google (Gemini)", value: "google" },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return provider as Provider;
}

async function pickModel(provider: Provider): Promise<string> {
  const models =
    provider === "openai"
      ? MODELS_OPENAI.map((m) => ({ label: m, value: m }))
      : MODELS_GOOGLE.map((m) => ({ label: m, value: m }));

  const model = await p.select({
    message: "Select an AI model",
    initialValue: provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash",
    options: models,
  });

  if (p.isCancel(model)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return model as string;
}

async function getApiKey(provider: Provider): Promise<string> {
  const envVar = provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY";
  const envKey = process.env[envVar]?.trim();
  if (envKey) return envKey;

  const key = await p.password({
    message: `Enter ${provider === "openai" ? "OpenAI" : "Google"} API key (not saved)`,
    validate: (v) =>
      (v ?? "").trim().length > 0 ? undefined : "API key cannot be empty",
  });

  if (p.isCancel(key)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return key.trim();
}

/* ----------------------------- Monorepo support ---------------------------- */

function readWorkspaceGlobs(rootAbs: string): string[] {
  const globs: string[] = [];

  // pnpm-workspace.yaml
  const pnpmWs = path.join(rootAbs, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmWs)) {
    const txt = fs.readFileSync(pnpmWs, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/);
      if (m) globs.push(m[1].trim());
    }
  }

  // package.json workspaces
  const pkgPath = path.join(rootAbs, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const ws = pkg?.workspaces;
      if (Array.isArray(ws)) globs.push(...ws);
      if (ws && Array.isArray(ws.packages)) globs.push(...ws.packages);
    } catch {
      // ignore
    }
  }

  return [...new Set(globs)].filter(Boolean);
}

function expandSimpleGlob(rootAbs: string, pattern: string): string[] {
  const norm = pattern.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!norm.includes("*")) {
    const abs = path.join(rootAbs, norm);
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? [norm] : [];
  }

  const m = norm.match(/^([^*]+)\/\*$/);
  if (!m) return [];

  const baseRel = m[1].replace(/\/+$/, "");
  const baseAbs = path.join(rootAbs, baseRel);
  if (!fs.existsSync(baseAbs) || !fs.statSync(baseAbs).isDirectory()) return [];

  const out: string[] = [];
  for (const name of fs.readdirSync(baseAbs)) {
    const rel = `${baseRel}/${name}`;
    const abs = path.join(rootAbs, rel);
    if (!fs.statSync(abs).isDirectory()) continue;
    if (fs.existsSync(path.join(abs, "package.json"))) out.push(rel);
  }
  return out;
}

function detectWorkspaces(rootAbs: string): string[] {
  const globs = readWorkspaceGlobs(rootAbs);
  const found = new Set<string>();

  for (const g of globs) {
    for (const rel of expandSimpleGlob(rootAbs, g)) found.add(rel);
  }

  // Turbo-style fallback if no globs detected
  if (found.size === 0) {
    for (const base of ["apps", "packages"]) {
      const baseAbs = path.join(rootAbs, base);
      if (!fs.existsSync(baseAbs) || !fs.statSync(baseAbs).isDirectory())
        continue;
      for (const name of fs.readdirSync(baseAbs)) {
        const rel = `${base}/${name}`;
        const abs = path.join(rootAbs, rel);
        if (!fs.statSync(abs).isDirectory()) continue;
        if (fs.existsSync(path.join(abs, "package.json"))) found.add(rel);
      }
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

async function pickWorkspaces(workspaces: string[]): Promise<string[]> {
  const picked = await p.multiselect({
    message: "Select workspaces to generate .env.example for",
    options: workspaces.map((w) => ({ label: w, value: w })),
    required: false,
  });

  if (p.isCancel(picked)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return (picked as string[]) ?? [];
}

/* -------------------------------------------------------------------------- */

const program = new Command();

program
  .name("asyq")
  .description("Generate .env.example by scanning your project for env usage")
  .version(`v${getPackageVersion()}`);

program
  .command("init")
  .description("Scan project and generate .env.example")
  .option("--root <dir>", "Project root to scan", ".")
  .option("--out <file>", "Output file name", ".env.example")
  .option("--force", "Overwrite output if it exists")
  .option(
    "--include-lowercase",
    "Include lowercase/mixed-case keys (not recommended)"
  )
  .option("--debug", "Print scan diagnostics")
  .option("--monorepo", "Generate .env.example for root + each workspace")
  .option(
    "--select",
    "In monorepo mode: interactively choose which workspaces to generate for"
  )
  .option(
    "--workspaces <list>",
    "In monorepo mode: comma-separated workspace list to generate for"
  )
  .option("--skip-root", "In monorepo mode: skip generating for repo root")
  .action(async (opts: Record<string, unknown>) => {
    p.intro(pc.cyan(`Asyq CLI v${getPackageVersion()} Created by @thev1ndu`));

    const rootAbs = path.resolve(process.cwd(), String(opts.root ?? "."));
    const outName = String(opts.out || ".env.example");

    const mode = await pickMode();
    const provider: Provider | null =
      mode === "ai" ? await pickProvider() : null;
    const model: string | null =
      mode === "ai" && provider ? await pickModel(provider) : null;

    const targets: { label: string; dirAbs: string }[] = [];

    // Root target (default on, unless --skip-root)
    if (!opts.skipRoot) {
      targets.push({ label: "root", dirAbs: rootAbs });
    }

    // Monorepo targets
    if (opts.monorepo) {
      const workspaces = detectWorkspaces(rootAbs);

      if (workspaces.length === 0) {
        p.note(
          "No workspaces detected (pnpm-workspace.yaml / package.json workspaces / apps/* / packages/*).",
          "Monorepo"
        );
      } else {
        let selected = workspaces;

        if (opts.workspaces) {
          const allow = new Set(
            String(opts.workspaces)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
          selected = workspaces.filter((w) => allow.has(w));
          const missing = [...allow].filter((x) => !workspaces.includes(x));
          if (missing.length) {
            p.note(missing.join("\n"), "Unknown workspaces ignored");
          }
        } else if (opts.select) {
          selected = await pickWorkspaces(workspaces);
        }

        for (const rel of selected) {
          targets.push({ label: rel, dirAbs: path.join(rootAbs, rel) });
        }
      }
    }

    if (targets.length === 0) {
      fail(
        "No targets selected. Tip: remove --skip-root or select at least one workspace."
      );
    }

    // API key once for all targets (AI mode)
    let apiKey = "";
    if (mode === "ai" && model && provider) {
      apiKey = await getApiKey(provider);
      if (!apiKey)
        fail(
          `${provider === "openai" ? "OpenAI" : "Google"} API key is required for AI-assisted mode.`,
        );
    }

    const results: Array<{
      target: string;
      outRel: string;
      keys: number;
      files: number;
      wrote: boolean;
    }> = [];

    for (const t of targets) {
      const outFileAbs = path.join(t.dirAbs, outName);
      const outRelFromRoot =
        path.relative(rootAbs, outFileAbs).replace(/\\/g, "/") || outName;

      if (fs.existsSync(outFileAbs) && !opts.force) {
        fail(
          `Output already exists: ${outRelFromRoot}. Use --force to overwrite.`
        );
      }

      const s = p.spinner();
      s.start(`Scanning ${t.label} for environment variables`);

      const res = scanProjectForEnvKeys({
        rootDir: t.dirAbs,
        includeLowercase: !!opts.includeLowercase,
      });

      s.stop(
        `Scan complete: ${t.label} (${res.filesScanned} files, ${res.keys.size} keys)`
      );

      if (opts.debug) {
        p.note(
          [
            `dir: ${t.dirAbs}`,
            `files scanned: ${res.filesScanned}`,
            `keys found: ${res.keys.size}`,
          ].join("\n"),
          `${t.label} diagnostics`
        );
      }

      // If no keys, skip writing (current behavior), but show a clear note.
      if (res.keys.size === 0) {
        p.note(
          `No env vars detected in ${t.label}. Skipping ${outRelFromRoot}`,
          "Nothing to write"
        );
        results.push({
          target: t.label,
          outRel: outRelFromRoot,
          keys: 0,
          files: res.filesScanned,
          wrote: false,
        });
        continue;
      }

      const keys = [...res.keys].sort((a, b) => a.localeCompare(b));
      let content = keys.map((k) => `${k}=`).join("\n") + "\n";

      if (mode === "ai" && model && provider) {
        const aiSpinner = p.spinner();
        aiSpinner.start(`Writing .env.example documentation for ${t.label}`);

        try {
          const opts = {
            apiKey,
            model,
            projectHint:
              "Write practical guidance for developers setting env vars.",
            contexts: res.contexts,
            keys,
          };
          const docs =
            provider === "openai"
              ? await generateEnvDocsWithOpenAI(opts)
              : await generateEnvDocsWithGoogle(opts);

          aiSpinner.stop(
            `Documented ${keys.length} env variables for ${t.label}`
          );

          const byKey = new Map(docs.map((d) => [d.key, d]));

          content =
            keys
              .map((k) => {
                const d = byKey.get(k);
                if (!d) return `${k}=\n`;

                const secretNote = d.is_secret
                  ? "Secret value. Do not commit."
                  : "Non-secret value (verify before committing).";

                return [
                  `# ${d.key}`,
                  `# ${d.description}`,
                  `# Where to get it: ${d.where_to_get}`,
                  `# ${secretNote}`,
                  `${d.key}=${d.example_value || ""}`,
                  "",
                ].join("\n");
              })
              .join("\n")
              .trimEnd() + "\n";
        } catch (e: any) {
          aiSpinner.stop(`Failed to write documentation for ${t.label}`);
          fail(e?.message ?? String(e));
        }
      }

      fs.writeFileSync(outFileAbs, content, "utf8");

      results.push({
        target: t.label,
        outRel: outRelFromRoot,
        keys: keys.length,
        files: res.filesScanned,
        wrote: true,
      });
    }

    // Summary table
    const summary = results
      .map((r) => {
        const status = r.wrote ? pc.green("wrote") : pc.yellow("skipped");
        return `${pc.cyan(r.target.padEnd(20))} ${pc.green(
          String(r.keys).padStart(3)
        )} keys → ${pc.dim(r.outRel)} ${pc.dim(`(${status})`)}`;
      })
      .join("\n");

    p.note(summary, "Generated");
    p.outro(pc.green("✓ All done!"));
  });

program.parse(process.argv);
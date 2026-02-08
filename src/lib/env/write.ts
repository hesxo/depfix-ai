import fs from "node:fs/promises";
import path from "node:path";
import { generateEnvDocsWithOpenAI } from "./ai.js";
import { renderEnv } from "./render.js";
import { scanEnv, scanEnvWithContext } from "./scan.js";
import { logInfo, logError } from "../ui/log.js";

export interface EnvGenerateFlags {
  out: string;
  create: boolean;
  force: boolean;
  check: boolean;
  ai: boolean;
  model: string;
  apiKey: string;
}

const defaultEnvFlags: EnvGenerateFlags = {
  out: ".env.example",
  create: false,
  force: false,
  check: false,
  ai: false,
  model: "gpt-4o-mini",
  apiKey: "",
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function parseEnvKeysFromExample(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key) keys.add(key);
  }
  return keys;
}

export async function runEnvGenerate(opts: Partial<EnvGenerateFlags> = {}) {
  const flags: EnvGenerateFlags = { ...defaultEnvFlags, ...opts };
  const cwd = process.cwd();
  const outPath = path.resolve(cwd, flags.out);
  const envPath = path.resolve(cwd, ".env");

  const scanResult = flags.ai
    ? await scanEnvWithContext(cwd, 2)
    : await scanEnv(cwd);

  if (flags.check) {
    if (!(await fileExists(outPath))) {
      logError(`${flags.out} does not exist. Run 'depfix-ai env generate' to create it.`);
      process.exitCode = 1;
      return;
    }

    const existing = await fs.readFile(outPath, "utf8");
    const existingKeys = parseEnvKeysFromExample(existing);
    const missing = scanResult.keys.filter((k) => !existingKeys.has(k));

    if (missing.length > 0) {
      logError(
        `${flags.out} is missing the following environment variables: ${missing.join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    logInfo(`${flags.out} contains all required environment variables.`);
    return;
  }

  let aiDocs: Awaited<ReturnType<typeof generateEnvDocsWithOpenAI>> | undefined;
  if (flags.ai && scanResult.keys.length > 0) {
    const apiKey = flags.apiKey || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      logError("AI mode requires OPENAI_API_KEY or --api-key.");
      process.exitCode = 1;
      return;
    }
    try {
      logInfo("Generating descriptions with AI…");
      type Ctx = { file: string; line: number; snippet: string }[];
      const contexts: Record<string, Ctx> =
        "contexts" in scanResult && scanResult.contexts
          ? scanResult.contexts
          : Object.create(null);
      aiDocs = await generateEnvDocsWithOpenAI({
        apiKey,
        model: flags.model,
        projectHint: "Practical guidance for developers setting env vars.",
        contexts,
        keys: scanResult.keys,
      });
    } catch (e) {
      logError((e as Error)?.message ?? String(e));
      process.exitCode = 1;
      return;
    }
  }

  // Always (re)write the template example file.
  const exampleContent = renderEnv(scanResult, aiDocs);
  await fs.writeFile(outPath, exampleContent, "utf8");
  logInfo(`Wrote environment template to ${outPath}`);

  if (flags.create) {
    const envExists = await fileExists(envPath);
    if (envExists && !flags.force) {
      logInfo(`.env already exists; not overwriting. Use --force to overwrite.`);
    } else {
      const envContent = scanResult.keys.map((k) => `${k}=`).join("\n") + "\n";
      await fs.writeFile(envPath, envContent, "utf8");
      logInfo(`Wrote ${envExists ? "updated" : "new"} .env file to ${envPath}`);
    }
  }
}


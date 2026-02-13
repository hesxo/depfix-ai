import fs from "node:fs/promises";
import path from "node:path";
import { scanProjectForEnvKeys } from "./scan.js";
import { renderEnv, renderEnvAi } from "./render.js"
import {
  generateEnvDocsWithOpenAI,
  generateEnvDocsWithGoogle,
  type AIGenerateOptions,
} from "./ai.js";
import { logInfo, logError, logSuccess } from "../ui/log.js";

export interface EnvGenerateFlags {
  out: string;
  create: boolean;
  force: boolean;
  check: boolean;
  cwd?: string;
  includeLowercase?: boolean;
  ai?: {
    provider?: "openai" | "google";
    model: string;
    apiKey: string;
    projectHint?: string;
  };
}

const defaultEnvFlags: EnvGenerateFlags = {
  out: ".env.example",
  create: false,
  force: false,
  check: false,
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
  for (const line of content.split(/\r?\n/)) {
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
  const cwd = opts.cwd ?? process.cwd();
  const outPath = path.resolve(cwd, flags.out);
  const envPath = path.resolve(cwd, ".env");

  const scanResult = scanProjectForEnvKeys({
    rootDir: cwd,
    includeLowercase: flags.includeLowercase,
  });

  const keys = Array.from(scanResult.keys).sort();
  const result = { keys, filesScanned: scanResult.filesScanned, contexts: scanResult.contexts };

  if (keys.length === 0) {
    logInfo("No environment variables found in source. Creating minimal .env.example template.");
  }

  if (flags.check) {
    if (!(await fileExists(outPath))) {
      logError(`${flags.out} does not exist. Run 'depfix-ai env generate' to create it.`);
      process.exitCode = 1;
      return;
    }
    const existing = await fs.readFile(outPath, "utf8");
    const existingKeys = parseEnvKeysFromExample(existing);
    const missing = keys.filter((k) => !existingKeys.has(k));
    if (missing.length > 0) {
      logError(`${flags.out} is missing the following environment variables: ${missing.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    logSuccess(`${flags.out} contains all required environment variables.`);
    return;
  }

  let exampleContent: string;
  if (flags.ai && keys.length > 0 && flags.ai.apiKey) {
    const opts = {
      apiKey: flags.ai.apiKey,
      model: flags.ai.model,
      projectHint: flags.ai.projectHint,
      contexts: result.contexts,
      keys,
    };
    const docs =
      flags.ai.provider === "google"
        ? await generateEnvDocsWithGoogle(opts)
        : await generateEnvDocsWithOpenAI(opts);
    exampleContent = renderEnvAi(docs);
  } else {
    exampleContent = renderEnv(result);
  }
  await fs.writeFile(outPath, exampleContent, "utf8");
  logSuccess(`Wrote environment template to ${outPath}`);

  if (flags.create) {
    const envExists = await fileExists(envPath);
    if (envExists && !flags.force) {
      logInfo(`.env already exists; not overwriting. Use --force to overwrite.`);
    } else {
      const envContent = keys.map((k) => `${k}=`).join("\n") + "\n";
      await fs.writeFile(envPath, envContent, "utf8");
      logSuccess(`Wrote ${envExists ? "updated" : "new"} .env file to ${envPath}`);
    }
  }
}

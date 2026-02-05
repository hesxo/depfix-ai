import fs from "node:fs/promises";
import path from "node:path";
import { scanEnv } from "./scan";
import { renderEnv } from "./render";
import { logInfo, logError } from "../ui/log";

interface EnvGenerateFlags {
  out: string;
  create: boolean;
  force: boolean;
  check: boolean;
}

function parseEnvArgs(argv: string[]): EnvGenerateFlags {
  const flags: EnvGenerateFlags = {
    out: ".env.example",
    create: false,
    force: false,
    check: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--out":
        if (argv[i + 1]) {
          flags.out = argv[i + 1];
          i++;
        } else {
          logError("Missing value for --out");
        }
        break;
      case "--create":
        flags.create = true;
        break;
      case "--force":
        flags.force = true;
        break;
      case "--check":
        flags.check = true;
        break;
      default:
        logError(`Unknown flag or argument: ${arg}`);
        break;
    }
  }

  return flags;
}

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

export async function runEnvGenerate(argv: string[] = []) {
  const flags = parseEnvArgs(argv);
  const cwd = process.cwd();
  const outPath = path.resolve(cwd, flags.out);
  const envPath = path.resolve(cwd, ".env");

  const scanResult = await scanEnv(cwd);

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

  // Always (re)write the template example file.
  const exampleContent = renderEnv(scanResult);
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


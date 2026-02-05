import fs from "node:fs/promises";
import fg from "fast-glob";

export interface EnvScanResult {
  keys: string[];
}

const INCLUDE_GLOBS = [
  "src/**/*.{js,jsx,ts,tsx}",
  "app/**/*.{js,jsx,ts,tsx}",
  "server/**/*.{js,jsx,ts,tsx}",
  "pages/**/*.{js,jsx,ts,tsx}",
];

const EXCLUDE_GLOBS = ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**", "**/coverage/**"];

const PROCESS_ENV_REGEX = /process\.env\.([A-Z0-9_]+)/g;
const IMPORT_META_ENV_REGEX = /import\.meta\.env\.([A-Z0-9_]+)/g;

export async function scanEnv(cwd = process.cwd()): Promise<EnvScanResult> {
  const files = await fg(INCLUDE_GLOBS, {
    cwd,
    ignore: EXCLUDE_GLOBS,
    absolute: true,
  });

  const keys = new Set<string>();

  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    let match: RegExpExecArray | null;

    while ((match = PROCESS_ENV_REGEX.exec(content)) !== null) {
      keys.add(match[1]);
    }

    while ((match = IMPORT_META_ENV_REGEX.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }

  return { keys: Array.from(keys).sort() };
}


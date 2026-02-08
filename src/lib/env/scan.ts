import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

export interface EnvScanResult {
  keys: string[];
}

export interface KeyContext {
  file: string;
  line: number;
  snippet: string;
}

export interface EnvScanWithContextResult extends EnvScanResult {
  contexts: Record<string, KeyContext[]>;
}

const INCLUDE_GLOBS = [
  "src/**/*.{js,jsx,ts,tsx,mjs,cjs}",
  "app/**/*.{js,jsx,ts,tsx,mjs,cjs}",
  "server/**/*.{js,jsx,ts,tsx,mjs,cjs}",
  "pages/**/*.{js,jsx,ts,tsx,mjs,cjs}",
];

const EXCLUDE_GLOBS = ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**", "**/coverage/**"];

const ENV_KEY_STRICT = /^[A-Z][A-Z0-9_]*$/;

// Patterns: [RegExp, group index for key]
const CODE_PATTERNS: [RegExp, number][] = [
  [/\bprocess(?:\?\.|\.)env(?:\?\.|\.)([A-Za-z_][A-Za-z0-9_]*)\b/g, 1],
  [/\bprocess(?:\?\.|\.)env\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g, 1],
  [/\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g, 1],
  [/\bDeno\.env\.get\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/g, 1],
  [/\bBun\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g, 1],
];

const PROCESS_ENV_REGEX = /process\.env\.([A-Z0-9_]+)/g;
const IMPORT_META_ENV_REGEX = /import\.meta\.env\.([A-Z0-9_]+)/g;

function keyOk(k: string): boolean {
  return ENV_KEY_STRICT.test(k);
}

export async function scanEnv(cwd = process.cwd()): Promise<EnvScanResult> {
  const withCtx = await scanEnvWithContext(cwd, 0);
  return { keys: withCtx.keys };
}

export async function scanEnvWithContext(
  cwd = process.cwd(),
  maxContextPerKey = 2,
): Promise<EnvScanWithContextResult> {
  const files = await fg(INCLUDE_GLOBS, {
    cwd,
    ignore: EXCLUDE_GLOBS,
    absolute: true,
  });

  const keys = new Set<string>();
  const contexts: Record<string, KeyContext[]> = {};

  function addCtx(key: string, relFile: string, line: number, snippet: string) {
    if (!keyOk(key)) return;
    keys.add(key);
    if (maxContextPerKey <= 0) return;
    if (!contexts[key]) contexts[key] = [];
    if (contexts[key].length >= maxContextPerKey) return;
    contexts[key].push({
      file: relFile,
      line,
      snippet: snippet.trim().slice(0, 220),
    });
  }

  for (const absPath of files) {
    let content: string;
    try {
      content = await fs.readFile(absPath, "utf8");
    } catch {
      continue;
    }
    const relFile = path.relative(cwd, absPath).replace(/\\/g, "/");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.trim().startsWith("//") || ln.trim().startsWith("#")) continue;

      for (const [re, group] of CODE_PATTERNS) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(ln)) !== null) {
          const k = match[group];
          if (!keyOk(k)) continue;
          addCtx(k, relFile, i + 1, ln);
        }
      }
    }
  }

  return {
    keys: Array.from(keys).sort(),
    contexts,
  };
}


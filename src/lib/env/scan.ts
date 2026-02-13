import fs from "node:fs";
import path from "node:path";

export type ScanOptions = {
  rootDir: string;
  includeLowercase?: boolean;
  maxContextPerKey?: number;
};

export type KeyContext = { file: string; line: number; snippet: string };

export type ScanResult = {
  keys: Set<string>;
  filesScanned: number;
  contexts: Record<string, KeyContext[]>;
};

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  ".vercel",
  ".netlify",
]);

const ENV_KEY_RE_STRICT = /^[A-Z][A-Z0-9_]*$/;
const ENV_KEY_RE_LOOSE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
]);

const CODE_PATTERNS: RegExp[] = [
  /\bprocess(?:\?\.|\.)env(?:\?\.|\.)([A-Za-z_][A-Za-z0-9_]*)\b/gi,
  /\bprocess(?:\?\.|\.)env\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/gi,
  /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/gi,
  /\bDeno\.env\.get\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/gi,
  /\bBun\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/gi,
];

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function extractFromEnvFile(
  text: string,
  relFile: string,
  keys: Set<string>,
  addCtx: (key: string, relFile: string, line: number, snippet: string) => void,
  keyOk: (k: string) => boolean,
): void {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim() || ln.trim().startsWith("#")) continue;
    const m = ln.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m) continue;
    const k = m[1];
    if (!keyOk(k)) continue;
    keys.add(k);
    addCtx(k, relFile, i + 1, ln);
  }
}

function extractFromCode(
  text: string,
  relFile: string,
  keys: Set<string>,
  seenInCode: Set<string>,
  addCtx: (key: string, relFile: string, line: number, snippet: string) => void,
  keyOk: (k: string) => boolean,
): void {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.trim().startsWith("//") || ln.trim().startsWith("#")) continue;
    for (const re of CODE_PATTERNS) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(ln))) {
        const k = match[1];
        if (!keyOk(k)) continue;
        keys.add(k);
        seenInCode.add(k);
        addCtx(k, relFile, i + 1, ln);
      }
    }
  }
}

export function scanProjectForEnvKeys(opts: ScanOptions): ScanResult {
  const root = opts.rootDir;
  const maxCtx = opts.maxContextPerKey ?? 2;
  const keyOk = (k: string) =>
    (opts.includeLowercase ? ENV_KEY_RE_LOOSE : ENV_KEY_RE_STRICT).test(k);

  const keys = new Set<string>();
  const contexts: Record<string, KeyContext[]> = {};
  let filesScanned = 0;
  const seenInCode = new Set<string>();

  function addCtx(key: string, relFile: string, line: number, snippet: string) {
    if (!contexts[key]) contexts[key] = [];
    if (contexts[key].length >= maxCtx) return;
    contexts[key].push({
      file: relFile,
      line,
      snippet: snippet.trim().slice(0, 220),
    });
  }

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) walk(full);
        continue;
      }

      const isEnvFile = entry.name === ".env" || entry.name.startsWith(".env.");
      const ext = path.extname(entry.name);

      if (!isEnvFile && !EXTS.has(ext)) continue;

      const content = safeRead(full);
      if (!content) continue;

      filesScanned++;
      const rel = path.relative(root, full).replace(/\\/g, "/");

      if (isEnvFile) {
        extractFromEnvFile(content, rel, keys, addCtx, keyOk);
      } else {
        extractFromCode(content, rel, keys, seenInCode, addCtx, keyOk);
      }
    }
  }

  walk(root);

  const finalKeys = new Set<string>();
  const seenInCodeUpper = new Set([...seenInCode].map((k) => k.toUpperCase()));

  for (const key of keys) {
    if (seenInCodeUpper.has(key.toUpperCase())) finalKeys.add(key);
  }

  for (const codeKey of seenInCode) {
    const upper = codeKey.toUpperCase();
    const found = [...finalKeys].some((k) => k.toUpperCase() === upper);
    if (!found && keyOk(codeKey)) finalKeys.add(codeKey);
  }

  return { keys: finalKeys, filesScanned, contexts };
}

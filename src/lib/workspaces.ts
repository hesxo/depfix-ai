import fs from "node:fs";
import path from "node:path";

/**
 * Read workspace glob patterns from pnpm-workspace.yaml or package.json workspaces.
 */
function readWorkspaceGlobs(rootAbs: string): string[] {
  const globs: string[] = [];

  const pnpmWs = path.join(rootAbs, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmWs)) {
    const txt = fs.readFileSync(pnpmWs, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/);
      if (m) globs.push(m[1].trim());
    }
  }

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

/**
 * Detect workspace paths (relative to root) for pnpm, npm, yarn workspaces,
 * or Turbo-style apps/* and packages/*.
 */
export function detectWorkspaces(rootAbs: string): string[] {
  const globs = readWorkspaceGlobs(rootAbs);
  const found = new Set<string>();

  for (const g of globs) {
    for (const rel of expandSimpleGlob(rootAbs, g)) found.add(rel);
  }

  if (found.size === 0) {
    for (const base of ["apps", "packages"]) {
      const baseAbs = path.join(rootAbs, base);
      if (!fs.existsSync(baseAbs) || !fs.statSync(baseAbs).isDirectory()) continue;
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

/**
 * Check if the given directory is a monorepo (has workspaces).
 */
export function isMonorepo(rootAbs: string): boolean {
  return detectWorkspaces(rootAbs).length > 0;
}

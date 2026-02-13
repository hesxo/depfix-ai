import type { AIEnvDoc } from "./ai.js";

export interface EnvScanResult {
  keys: string[];
  filesScanned: number;
  contexts: Record<string, { file: string; line: number; snippet: string }[]>;
}

const GROUPS_PREFIX: { prefix: string; heading: string }[] = [
  { prefix: "DB_", heading: "Database" },
  { prefix: "REDIS_", heading: "Redis" },
  { prefix: "AWS_", heading: "AWS" },
  { prefix: "SMTP_", heading: "SMTP" },
  { prefix: "NEXT_PUBLIC_", heading: "Next.js public env" },
  { prefix: "VITE_", heading: "Vite env" },
];

export function renderEnv(result: EnvScanResult): string {
  const remaining = new Set(result.keys);
  const groups: { heading: string; keys: string[] }[] = [];

  for (const { prefix, heading } of GROUPS_PREFIX) {
    const keys = result.keys.filter((k) => k.startsWith(prefix));
    if (keys.length === 0) continue;
    keys.forEach((k) => remaining.delete(k));
    groups.push({ heading, keys });
  }

  if (remaining.size > 0) {
    groups.push({ heading: "Other", keys: Array.from(remaining).sort() });
  }

  const lines: string[] = [];
  if (result.keys.length === 0) {
    lines.push("# .env.example");
    lines.push("# Add your environment variables below (e.g. PORT=3000)");
    lines.push("");
    return lines.join("\n") + "\n";
  }

  for (const group of groups) {
    lines.push(`# ${group.heading}`);
    for (const key of group.keys) lines.push(`${key}=`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + (lines.length ? "\n" : "");
}

export function renderEnvAi(docs: AIEnvDoc[]): string {
  if (docs.length === 0) return "";

  const byPrefix = new Map<string, AIEnvDoc[]>();
  for (const { prefix, heading } of GROUPS_PREFIX) {
    const items = docs.filter((d) => d.key.startsWith(prefix));
    if (items.length > 0) byPrefix.set(heading, items);
  }
  const other = docs.filter(
    (d) => !GROUPS_PREFIX.some(({ prefix }) => d.key.startsWith(prefix)),
  );
  if (other.length > 0) byPrefix.set("Other", other.sort((a, b) => a.key.localeCompare(b.key)));

  const headings = [...GROUPS_PREFIX.map((g) => g.heading), "Other"].filter((h) => byPrefix.has(h));
  const lines: string[] = [];
  for (const heading of headings) {
    const items = byPrefix.get(heading)!;
    for (const d of items) {
      const secretNote = d.is_secret ? "Secret value. Do not commit." : "Non-secret value (verify before committing).";
      lines.push(`# ${d.key}`);
      lines.push(`# ${d.description}`);
      lines.push(`# Where to get it: ${d.where_to_get}`);
      lines.push(`# ${secretNote}`);
      lines.push(`${d.key}=${d.example_value || ""}`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

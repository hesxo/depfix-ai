import { EnvScanResult } from "./scan.js";
import type { EnvVarEnriched } from "./ai.js";

interface GroupedKeys {
  heading: string;
  keys: string[];
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
  const groups: GroupedKeys[] = [];

  for (const { prefix, heading } of GROUPS_PREFIX) {
    const keys = result.keys.filter((k) => k.startsWith(prefix));
    if (keys.length === 0) continue;
    keys.forEach((k) => remaining.delete(k));
    groups.push({ heading, keys });
  }

  if (remaining.size > 0) {
    groups.push({
      heading: "Other",
      keys: Array.from(remaining).sort(),
    });
  }

  const lines: string[] = [];

  for (const group of groups) {
    lines.push(`# ${group.heading}`);
    for (const key of group.keys) {
      lines.push(`${key}=`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + (lines.length ? "\n" : "");
}

/**
 * Render .env.example with AI-generated descriptions and example values.
 */
export function renderEnvAi(enriched: EnvVarEnriched[]): string {
  if (enriched.length === 0) return "";

  const byPrefix = new Map<string, EnvVarEnriched[]>();
  for (const { prefix, heading } of GROUPS_PREFIX) {
    const keys = enriched.filter((e) => e.key.startsWith(prefix));
    if (keys.length > 0) {
      byPrefix.set(heading, keys);
    }
  }
  const other = enriched.filter(
    (e) => !GROUPS_PREFIX.some(({ prefix }) => e.key.startsWith(prefix)),
  );
  if (other.length > 0) {
    byPrefix.set("Other", other.sort((a, b) => a.key.localeCompare(b.key)));
  }

  const headings = [...GROUPS_PREFIX.map((g) => g.heading), "Other"].filter((h) =>
    byPrefix.has(h),
  );
  const lines: string[] = [];
  for (const heading of headings) {
    const items = byPrefix.get(heading)!;
    lines.push(`# ${heading}`);
    for (const { key, description, example } of items) {
      if (description) lines.push(`# ${description}`);
      lines.push(`${key}=${example || ""}`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}


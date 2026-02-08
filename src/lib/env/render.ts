import type { AIEnvDoc } from "./ai.js";
import type { EnvScanResult } from "./scan.js";

interface GroupedKeys {
  heading: string;
  keys: string[];
}

const GROUPS: { prefix: string; heading: string }[] = [
  { prefix: "DB_", heading: "Database" },
  { prefix: "REDIS_", heading: "Redis" },
  { prefix: "AWS_", heading: "AWS" },
  { prefix: "SMTP_", heading: "SMTP" },
  { prefix: "NEXT_PUBLIC_", heading: "Next.js public env" },
  { prefix: "VITE_", heading: "Vite env" },
];

export function renderEnv(
  result: EnvScanResult,
  aiDocs?: AIEnvDoc[],
): string {
  const remaining = new Set(result.keys);
  const groups: GroupedKeys[] = [];

  for (const { prefix, heading } of GROUPS) {
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

  const byKey = aiDocs?.length
    ? new Map(aiDocs.map((d) => [d.key, d]))
    : null;

  const lines: string[] = [];

  for (const group of groups) {
    lines.push(`# ${group.heading}`);
    for (const key of group.keys) {
      const d = byKey?.get(key);
      if (d) {
        const secretNote = d.is_secret
          ? "Secret value. Do not commit."
          : "Non-secret value (verify before committing).";
        lines.push(`# ${d.key}`);
        lines.push(`# ${d.description}`);
        lines.push(`# Where to get it: ${d.where_to_get}`);
        lines.push(`# ${secretNote}`);
        lines.push(`${d.key}=${d.example_value ?? ""}`);
      } else {
        lines.push(`${key}=`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + (lines.length ? "\n" : "");
}


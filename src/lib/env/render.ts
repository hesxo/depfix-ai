import { EnvScanResult } from "./scan.js";

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

export function renderEnv(result: EnvScanResult): string {
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


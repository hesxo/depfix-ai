import { EnvScanResult } from "./scan";

export function renderEnv(result: EnvScanResult): string {
  return result.keys.map((k) => `# ${k}`).join("\n");
}


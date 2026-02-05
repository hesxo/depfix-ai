export interface EnvScanResult {
  keys: string[];
}

export function scanEnv(): EnvScanResult {
  const keys = Object.keys(process.env).sort();
  return { keys };
}


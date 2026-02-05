export interface Config {
  dryRun: boolean;
}

let currentConfig: Config = {
  dryRun: false,
};

export function getConfig(): Config {
  return currentConfig;
}

export function setConfig(next: Partial<Config>) {
  currentConfig = { ...currentConfig, ...next };
}


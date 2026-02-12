import pc from "picocolors";

const PREFIX = pc.dim("depfix-ai");

export function logInfo(message: string, ...rest: unknown[]) {
  console.log(pc.cyan("ℹ"), PREFIX, message, ...rest);
}

export function logSuccess(message: string, ...rest: unknown[]) {
  console.log(pc.green("✓"), PREFIX, message, ...rest);
}

export function logError(message: string, ...rest: unknown[]) {
  console.error(pc.red("✗"), PREFIX, message, ...rest);
}

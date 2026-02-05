import chalk from "chalk";

export function logInfo(message: string, ...rest: unknown[]) {
  console.log(chalk.cyan("[depfix-ai]"), message, ...rest);
}

export function logError(message: string, ...rest: unknown[]) {
  console.error(chalk.red("[depfix-ai]"), message, ...rest);
}


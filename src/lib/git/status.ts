import { execa } from "execa";

export async function gitStatusShort(cwd = process.cwd()): Promise<string> {
  const { stdout } = await execa("git", ["status", "--short"], { cwd });
  return stdout;
}


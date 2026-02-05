import { execa } from "execa";

export async function gitCommitAll(message: string, cwd = process.cwd()): Promise<void> {
  await execa("git", ["add", "-A"], { cwd, stdio: "inherit" });
  await execa("git", ["commit", "-m", message], { cwd, stdio: "inherit" });
}


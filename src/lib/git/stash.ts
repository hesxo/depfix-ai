import { execa } from "execa";

export async function gitStashSave(message = "depfix-ai backup", cwd = process.cwd()): Promise<void> {
  await execa("git", ["stash", "push", "-m", message], { cwd, stdio: "inherit" });
}


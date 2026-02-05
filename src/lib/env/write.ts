import fs from "node:fs/promises";
import path from "node:path";
import { scanEnv } from "./scan";
import { renderEnv } from "./render";
import { logInfo } from "../ui/log";

export async function runEnvGenerate() {
  const scanResult = scanEnv();
  const content = renderEnv(scanResult);
  const outPath = path.join(process.cwd(), ".env.generated");
  await fs.writeFile(outPath, content, "utf8");
  logInfo(`Wrote environment snapshot to ${outPath}`);
}


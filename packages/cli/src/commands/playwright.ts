import { readFile } from "node:fs/promises";
import { extractPlaywrightTargets } from "@uiheal/adapters-playwright";

export async function scanPlaywrightFile(path: string): Promise<unknown> {
  return { targets: extractPlaywrightTargets(await readFile(path, "utf8"), path) };
}

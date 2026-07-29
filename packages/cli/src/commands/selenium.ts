import { readFile } from "node:fs/promises";
import { extractSeleniumTargets } from "@uiheal/adapters-selenium";

export async function scanSeleniumFile(path: string): Promise<unknown> {
  return { targets: extractSeleniumTargets(await readFile(path, "utf8"), path) };
}

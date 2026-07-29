import { readFile } from "node:fs/promises";
import { extractPuppeteerTargets } from "@uiheal/adapters-puppeteer";

export async function scanPuppeteerFile(path: string): Promise<unknown> {
  return { targets: extractPuppeteerTargets(await readFile(path, "utf8"), path) };
}

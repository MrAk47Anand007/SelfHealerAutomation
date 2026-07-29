import type { UiTarget } from "@uiheal/core";

export function extractPuppeteerTargets(source: string, filePath: string): UiTarget[] {
  const targets: UiTarget[] = [];
  const patterns = [/page\.waitForSelector\(["'`]([^"'`]+)["'`]\)/g, /page\.\$\(["'`]([^"'`]+)["'`]\)/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      targets.push({
        id: `${filePath}:${match.index}`,
        sourceTool: "puppeteer",
        selectors: [{ kind: "css", value: match[1], enabled: true }],
        element: {},
        metadata: { filePath }
      });
    }
  }
  return targets.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

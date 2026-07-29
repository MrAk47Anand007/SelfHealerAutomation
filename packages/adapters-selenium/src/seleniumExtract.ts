import type { SelectorKind, UiTarget } from "@uiheal/core";

const byMap: Record<string, SelectorKind> = {
  ID: "id",
  NAME: "name",
  CSS_SELECTOR: "css",
  XPATH: "xpath"
};

export function extractSeleniumTargets(source: string, filePath: string): UiTarget[] {
  const targets: UiTarget[] = [];
  for (const match of source.matchAll(/By\.([A-Z_]+)\s*,\s*["'`]([^"'`]+)["'`]/g)) {
    const kind = byMap[match[1]];
    if (!kind) continue;
    targets.push({
      id: `${filePath}:${match.index}`,
      sourceTool: "selenium",
      selectors: [{ kind, value: match[2], enabled: true }],
      element: {},
      metadata: { filePath }
    });
  }
  return targets;
}

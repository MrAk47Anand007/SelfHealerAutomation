import type { UiTarget } from "@uiheal/core";

export function extractPlaywrightTargets(source: string, filePath: string): UiTarget[] {
  const targets: UiTarget[] = [];
  for (const match of source.matchAll(/page\.locator\(["'`]([^"'`]+)["'`]\)/g)) {
    targets.push({
      id: `${filePath}:${match.index}`,
      sourceTool: "playwright",
      selectors: [{ kind: "css", value: match[1], enabled: true }],
      element: {},
      metadata: { filePath, offset: match.index ?? 0 }
    });
  }
  for (const match of source.matchAll(/page\.getByRole\(["'`]([^"'`]+)["'`]\s*,\s*\{\s*name:\s*["'`]([^"'`]+)["'`]/g)) {
    targets.push({
      id: `${filePath}:${match.index}`,
      sourceTool: "playwright",
      selectors: [{ kind: "role", value: `${match[1]}:${match[2]}`, enabled: true }],
      element: { role: match[1], text: match[2] },
      metadata: { filePath, offset: match.index ?? 0 }
    });
  }
  for (const match of source.matchAll(/page\.getByLabel\(["'`]([^"'`]+)["'`]\)/g)) {
    targets.push({
      id: `${filePath}:${match.index}`,
      sourceTool: "playwright",
      selectors: [{ kind: "text", value: match[1], enabled: true }],
      element: { label: match[1] },
      metadata: { filePath, offset: match.index ?? 0 }
    });
  }
  for (const match of source.matchAll(/page\.getByText\(["'`]([^"'`]+)["'`]\)/g)) {
    targets.push({
      id: `${filePath}:${match.index}`,
      sourceTool: "playwright",
      selectors: [{ kind: "text", value: match[1], enabled: true }],
      element: { text: match[1] },
      metadata: { filePath, offset: match.index ?? 0 }
    });
  }
  return targets.sort((a, b) => Number(a.metadata?.offset ?? 0) - Number(b.metadata?.offset ?? 0));
}

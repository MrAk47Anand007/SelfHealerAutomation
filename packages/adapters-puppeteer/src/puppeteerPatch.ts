import type { PatchPlan, RepairSuggestion } from "@uiheal/core";

export function createPuppeteerPatchPreview(filePath: string, suggestion: RepairSuggestion): PatchPlan {
  return {
    artifactType: "puppeteer",
    targetId: suggestion.targetId,
    operations: [{ op: "replace", path: `${filePath}:${suggestion.targetId}`, value: suggestion.selector.value }],
    preview: `Replace Puppeteer selector in ${filePath} with ${suggestion.selector.value}`
  };
}

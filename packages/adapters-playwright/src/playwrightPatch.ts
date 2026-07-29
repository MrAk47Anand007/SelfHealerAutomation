import type { PatchPlan, RepairSuggestion } from "@uiheal/core";

export function createPlaywrightPatchPreview(filePath: string, suggestion: RepairSuggestion): PatchPlan {
  return {
    artifactType: "playwright",
    targetId: suggestion.targetId,
    operations: [{ op: "replace", path: `${filePath}:${suggestion.targetId}`, value: suggestion.selector.value }],
    preview: `Replace Playwright locator in ${filePath} with ${suggestion.selector.value}`
  };
}

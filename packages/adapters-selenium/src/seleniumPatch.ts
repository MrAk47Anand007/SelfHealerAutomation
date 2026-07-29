import type { PatchPlan, RepairSuggestion } from "@uiheal/core";

export function createSeleniumPatchPreview(filePath: string, suggestion: RepairSuggestion): PatchPlan {
  return {
    artifactType: "selenium",
    targetId: suggestion.targetId,
    operations: [{ op: "replace", path: `${filePath}:${suggestion.targetId}`, value: suggestion.selector.value }],
    preview: `Replace Selenium selector in ${filePath} with ${suggestion.selector.value}`
  };
}

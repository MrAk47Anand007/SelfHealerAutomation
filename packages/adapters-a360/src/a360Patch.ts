import type { PatchPlan, RepairSuggestion } from "@uiheal/core";
import type { A360BotContent } from "./a360Bot.js";

type MutableCriteria = Record<string, unknown>;
type MutableNode = {
  uid: string;
  attributes?: Array<{ value?: { type?: string; uiObject?: { criteria?: MutableCriteria } } }>;
};

export function createA360PatchPlan(_bot: A360BotContent, suggestion: RepairSuggestion): PatchPlan {
  return {
    artifactType: "a360",
    targetId: suggestion.targetId,
    operations: [
      {
        op: "replace",
        path: `$.nodes[uid=${suggestion.targetId}].attributes[uiObject].value.uiObject.criteria.CSS Selector`,
        value: {
          enabled: true,
          value: { type: "STRING", string: suggestion.selector.value }
        }
      }
    ],
    preview: `Replace A360 CSS Selector for ${suggestion.targetId} with ${suggestion.selector.value}`
  };
}

export function applyA360PatchPreview(bot: A360BotContent, plan: PatchPlan): A360BotContent {
  const clone = structuredClone(bot) as A360BotContent;
  const nodes = clone.nodes as MutableNode[] | undefined;
  const node = nodes?.find((item) => item.uid === plan.targetId);
  const uiAttribute = node?.attributes?.find((attribute) => attribute.value?.type === "UIOBJECT");
  const criteria = uiAttribute?.value?.uiObject?.criteria;
  const cssOperation = plan.operations.find((operation) => operation.path.includes("CSS Selector"));
  if (!criteria || !cssOperation) return clone;
  criteria["CSS Selector"] = cssOperation.value;
  return clone;
}

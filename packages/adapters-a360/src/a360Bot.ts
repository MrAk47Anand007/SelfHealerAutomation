import type { UiSelector, UiTarget } from "@uiheal/core";
import { decodeA360Blob, extractSurroundingContext, summarizeA360Blob } from "./a360Blob.js";

type A360Value = { type?: string; string?: string; number?: string; boolean?: boolean };
type A360Criteria = Record<string, { enabled: boolean; value: A360Value }>;
type A360UiObject = {
  blob?: string;
  controlType?: string;
  technologyType?: string;
  browserType?: string;
  criteria?: A360Criteria;
};
type A360Attribute = { name: string; value: { type?: string; uiObject?: A360UiObject } };
type A360Node = {
  uid: string;
  commandName: string;
  packageName: string;
  disabled?: boolean;
  attributes?: A360Attribute[];
};
export type A360BotContent = { nodes?: A360Node[]; [key: string]: unknown };

function criteriaString(criteria: A360Criteria | undefined, key: string): string | undefined {
  const item = criteria?.[key];
  return item?.value?.string;
}

function criteriaSelector(criteria: A360Criteria, key: string, kind: UiSelector["kind"]): UiSelector | null {
  const item = criteria[key];
  const value = item?.value?.string;
  if (!value) return null;
  return { kind, value, enabled: Boolean(item.enabled), source: "a360" };
}

function selectorsFromCriteria(criteria: A360Criteria | undefined): UiSelector[] {
  if (!criteria) return [];
  return [
    criteriaSelector(criteria, "CSS Selector", "css"),
    criteriaSelector(criteria, "DOMXPath", "xpath"),
    criteriaSelector(criteria, "HTML ID", "id"),
    criteriaSelector(criteria, "HTML Name", "name"),
    criteriaSelector(criteria, "Path", "a360-path")
  ].filter((selector): selector is UiSelector => Boolean(selector));
}

function uiObjectAttribute(node: A360Node): A360Attribute | undefined {
  return node.attributes?.find((attribute) => attribute.value?.type === "UIOBJECT" && attribute.value.uiObject);
}

export function extractA360Targets(bot: A360BotContent): UiTarget[] {
  return (bot.nodes ?? [])
    .filter((node) => node.packageName === "Recorder")
    .flatMap((node) => {
      const uiAttribute = uiObjectAttribute(node);
      const uiObject = uiAttribute?.value?.uiObject;
      if (!uiObject) return [];
      const decoded = uiObject.blob ? decodeA360Blob(uiObject.blob) : {};
      const surroundingContext = extractSurroundingContext(decoded);
      const blobSummary = summarizeA360Blob(decoded);
      const criteria = uiObject.criteria;
      const tag = criteriaString(criteria, "HTML Tag")?.toLowerCase();
      return [
        {
          id: node.uid,
          sourceTool: "a360",
          action: `Recorder.${node.commandName}`,
          selectors: selectorsFromCriteria(criteria),
          url: criteriaString(criteria, "HTML FrameSrc"),
          frame: { url: criteriaString(criteria, "HTML FrameSrc"), path: criteriaString(criteria, "HTML FramePath") },
          element: {
            tag,
            type: criteriaString(criteria, "HTML Type"),
            id: criteriaString(criteria, "HTML ID"),
            name: criteriaString(criteria, "HTML Name"),
            text: criteriaString(criteria, "HTML InnerText"),
            classes: criteriaString(criteria, "HTML Class")?.split(/\s+/).filter(Boolean)
          },
          surroundingContext,
          metadata: {
            nodeUid: node.uid,
            uiAttributeName: uiAttribute?.name,
            controlType: uiObject.controlType,
            technologyType: uiObject.technologyType,
            browserType: uiObject.browserType,
            a360Blob: blobSummary
          }
        }
      ];
    });
}

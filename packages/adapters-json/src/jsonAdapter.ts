import { z } from "zod";
import type { PatchPlan, UiTarget } from "@uiheal/core";

const selectorSchema = z.object({
  kind: z.enum(["css", "xpath", "id", "name", "text", "role", "a360-path"]),
  value: z.string(),
  enabled: z.boolean(),
  source: z.string().optional(),
  weight: z.number().optional()
});

const targetSchema = z.object({
  id: z.string(),
  sourceTool: z.literal("generic").default("generic"),
  action: z.string().optional(),
  selectors: z.array(selectorSchema),
  url: z.string().optional(),
  frame: z.object({ url: z.string().optional(), name: z.string().optional(), path: z.string().optional() }).optional(),
  element: z.record(z.unknown()),
  surroundingContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const catalogSchema = z.object({
  targets: z.array(targetSchema)
});

export function readJsonTargets(input: unknown): UiTarget[] {
  return catalogSchema.parse(input).targets as UiTarget[];
}

export function createJsonPatchPlan(target: UiTarget, selectorValue: string): PatchPlan {
  return {
    artifactType: "generic",
    targetId: target.id,
    operations: [
      {
        op: "replace",
        path: `$.targets[?id=${target.id}].selectors[0]`,
        value: { kind: "css", value: selectorValue, enabled: true, source: "uiheal" }
      }
    ],
    preview: `Replace primary selector for ${target.id} with ${selectorValue}`
  };
}

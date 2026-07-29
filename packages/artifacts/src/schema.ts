import { z } from "zod";

const selectorSchema = z.object({
  kind: z.enum(["css", "xpath", "id", "name", "text", "role", "a360-path"]),
  value: z.string(),
  enabled: z.boolean(),
  source: z.string().optional(),
  weight: z.number().optional()
});

const targetSchema = z.object({
  id: z.string(),
  sourceTool: z.enum(["a360", "playwright", "selenium", "puppeteer", "generic"]),
  action: z.string().optional(),
  selectors: z.array(selectorSchema),
  url: z.string().optional(),
  frame: z.object({ url: z.string().optional(), name: z.string().optional(), path: z.string().optional() }).optional(),
  element: z.record(z.string(), z.unknown()),
  rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  surroundingContext: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const candidateSchema = z.object({
  candidateId: z.string(),
  selector: selectorSchema.optional(),
  url: z.string().optional(),
  frame: z.object({ url: z.string().optional(), name: z.string().optional(), path: z.string().optional() }).optional(),
  element: z.record(z.string(), z.unknown()),
  rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  surroundingContext: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const patchPlanSchema = z.object({
  artifactType: z.enum(["a360", "playwright", "selenium", "puppeteer", "generic"]),
  targetId: z.string(),
  operations: z.array(z.object({ path: z.string(), op: z.enum(["replace", "add"]), value: z.unknown() })),
  preview: z.string()
});

export const uiHealRunSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  createdAt: z.string(),
  mode: z.enum(["analyze", "plan", "heal", "heal-rerun", "execute-workflow"]),
  source: z.object({
    tool: z.enum(["a360", "playwright", "selenium", "puppeteer", "generic"]),
    kind: z.enum(["file", "a360-control-room", "inline", "snapshot"]),
    ref: z.string(),
    sha256: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  environment: z.object({
    runtime: z.literal("local-cli"),
    rdpSafe: z.boolean(),
    cdpPort: z.number().optional(),
    origins: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  policy: z.object({
    allowedTools: z.array(z.enum(["a360", "playwright", "selenium", "puppeteer", "generic"])),
    allowedOrigins: z.array(z.string()),
    minAutoHealConfidence: z.number(),
    allowDestructiveActions: z.boolean(),
    allowApply: z.boolean(),
    redactSecrets: z.boolean()
  }),
  inputs: z.object({ targets: z.array(targetSchema) }),
  outputs: z.object({
    candidatesByTargetId: z.record(z.array(candidateSchema)),
    results: z.array(z.unknown()),
    repairSuggestions: z.array(z.unknown()),
    patchPlans: z.array(patchPlanSchema),
    summary: z.record(z.string(), z.unknown()),
    aiGuidance: z.array(z.unknown()).optional(),
    aiWarning: z.string().optional(),
    statePlan: z.record(z.string(), z.unknown()).optional(),
    patchResult: z.record(z.string(), z.unknown()).optional(),
    rerunResult: z.record(z.string(), z.unknown()).optional()
  }),
  audit: z.object({
    redacted: z.boolean(),
    events: z.array(z.object({ at: z.string(), level: z.enum(["info", "warn", "error"]), message: z.string() }))
  })
});

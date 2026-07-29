import type { PatchPlan, SourceTool, UiTarget } from "@uiheal/core";
import type { PolicyDecision, UIHealPolicy, UIHealRun } from "./types.js";

const DESTRUCTIVE_PATTERN = /delete|remove|approve|payment|pay now|submit payment|admin|export|terminate|disable/i;

function originFor(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function evaluatePolicy(input: {
  run: UIHealRun;
  policy?: Partial<UIHealPolicy>;
  patchPlans?: PatchPlan[];
}): PolicyDecision {
  const policy = { ...input.run.policy, ...input.policy };
  const patchPlans = input.patchPlans ?? input.run.outputs.patchPlans;
  const violations: string[] = [];
  const warnings: string[] = [];
  const tools = new Set<SourceTool>(input.run.inputs.targets.map((target) => target.sourceTool));

  for (const tool of tools) {
    if (!policy.allowedTools.includes(tool)) violations.push(`Tool ${tool} is not allowed`);
  }

  for (const target of input.run.inputs.targets) {
    const origin = originFor(target.url);
    if (origin && policy.allowedOrigins.length > 0 && !policy.allowedOrigins.includes(origin)) {
      violations.push(`Origin ${origin} is not allowed for target ${target.id}`);
    }
    if (!policy.allowDestructiveActions && isDestructiveTarget(target)) {
      violations.push(`Target ${target.id} appears destructive`);
    }
  }

  for (const result of input.run.outputs.results) {
    if (result.status !== "pass" && result.confidence < policy.minAutoHealConfidence) {
      const message = `Target ${result.targetId} confidence ${result.confidence} is below auto-heal threshold ${policy.minAutoHealConfidence}`;
      if (patchPlans.some((plan) => plan.targetId === result.targetId)) violations.push(message);
      else warnings.push(message);
    }
  }

  if (patchPlans.length > 0 && !policy.allowApply) violations.push("Patch apply is disabled by policy");

  return {
    allowed: violations.length === 0,
    reason: violations.length === 0 ? "Policy checks passed" : "Policy checks blocked execution",
    violations,
    warnings
  };
}

export function isDestructiveTarget(target: UiTarget): boolean {
  return DESTRUCTIVE_PATTERN.test(
    [target.id, target.action, target.element.text, target.element.label, target.element.name, target.element.id]
      .filter(Boolean)
      .join(" ")
  );
}

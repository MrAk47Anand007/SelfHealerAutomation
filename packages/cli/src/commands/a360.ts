import { createA360PatchPlan, extractA360Targets, type A360BotContent } from "@uiheal/adapters-a360";
import {
  createPreflightSummary,
  suggestRepair,
  validateTarget,
  type PatchPlan,
  type UiCandidate,
  type ValidationResult
} from "@uiheal/core";

export interface A360PreflightInput {
  bot: A360BotContent;
  candidatesByTargetId: Record<string, UiCandidate[]>;
}

export interface A360PreflightResult {
  results: ValidationResult[];
  patchPlans: PatchPlan[];
  summary: ReturnType<typeof createPreflightSummary>;
  aiWarning?: string;
  aiGuidance?: Array<Record<string, unknown>>;
  statePlan?: Record<string, unknown>;
}

export async function runA360Preflight(input: A360PreflightInput): Promise<A360PreflightResult> {
  const targets = extractA360Targets(input.bot);
  const results = targets.map((target) => validateTarget(target, input.candidatesByTargetId[target.id] ?? []));
  const patchPlans = targets.flatMap((target) => {
    const suggestion = suggestRepair(target, input.candidatesByTargetId[target.id] ?? []);
    return suggestion ? [createA360PatchPlan(input.bot, suggestion)] : [];
  });
  return {
    results,
    patchPlans,
    summary: createPreflightSummary(results)
  };
}

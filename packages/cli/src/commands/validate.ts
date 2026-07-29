import { createPreflightSummary, validateTarget, type UiCandidate, type ValidationResult } from "@uiheal/core";
import { readJsonTargets } from "@uiheal/adapters-json";

export interface ValidateCommandInput {
  targets: unknown;
  candidates: UiCandidate[];
}

export interface ValidateCommandResult {
  results: ValidationResult[];
  summary: ReturnType<typeof createPreflightSummary>;
}

export async function runValidateCommand(input: ValidateCommandInput): Promise<ValidateCommandResult> {
  const targets = readJsonTargets(input.targets);
  const results = targets.map((target) => validateTarget(target, input.candidates));
  return {
    results,
    summary: createPreflightSummary(results)
  };
}

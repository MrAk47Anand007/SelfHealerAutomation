import type { RepairSuggestion, UiCandidate, UiTarget } from "../model/types.js";
import { scoreCandidate } from "../validate/validator.js";

export function suggestRepair(target: UiTarget, candidates: UiCandidate[]): RepairSuggestion | null {
  const scored = candidates
    .filter((candidate) => candidate.selector)
    .map((candidate) => ({ candidate, result: scoreCandidate(target, candidate) }))
    .sort((a, b) => b.result.confidence - a.result.confidence);

  const best = scored[0];
  if (!best || !best.candidate.selector || best.result.confidence < 0.6) return null;

  return {
    targetId: target.id,
    selector: best.candidate.selector,
    confidence: best.result.confidence,
    reason: best.result.reason,
    candidate: best.candidate
  };
}

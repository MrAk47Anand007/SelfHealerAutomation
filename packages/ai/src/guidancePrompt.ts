import type { GuidancePromptInput, OpenRouterMessage } from "./types.js";
import { redactGuidanceEvidence } from "./redaction.js";

export function buildGuidancePrompt(input: GuidancePromptInput): OpenRouterMessage[] {
  const compact = redactGuidanceEvidence({
    target: {
      id: input.target.id,
      sourceTool: input.target.sourceTool,
      action: input.target.action,
      selectors: input.target.selectors,
      url: input.target.url,
      element: input.target.element
    },
    validation: input.validation,
    candidates: input.candidates.slice(0, 5).map((candidate) => ({
      candidateId: candidate.candidateId,
      selector: candidate.selector,
      element: candidate.element,
      url: candidate.url,
      metadata: candidate.metadata
    })),
    patchPreview: input.patchPlan?.preview
  });

  return [
    {
      role: "system",
      content:
        "You are UIHeal guidance. Explain UI automation selector failures using only provided compact evidence. Recommend deterministic selector repairs. Do not ask for secrets or credentials."
    },
    {
      role: "user",
      content: JSON.stringify(compact, null, 2)
    }
  ];
}

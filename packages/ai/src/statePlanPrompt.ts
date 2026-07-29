import type { OpenRouterMessage, StatePlanPromptInput } from "./types.js";
import { redactGuidanceEvidence } from "./redaction.js";

export function buildStatePlanPrompt(input: StatePlanPromptInput): OpenRouterMessage[] {
  const compact = redactGuidanceEvidence(input);
  return [
    {
      role: "system",
      content:
        "You are UIHeal state planner. Generate safe, reviewable Playwright setup plans for preparing browser state before UI automation validation. Never include secrets. Require human review."
    },
    {
      role: "user",
      content: JSON.stringify(compact, null, 2)
    }
  ];
}

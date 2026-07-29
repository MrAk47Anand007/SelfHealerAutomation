import type { PatchPlan, UiCandidate, UiTarget, ValidationResult } from "@uiheal/core";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export interface AiGuidanceClient {
  complete(messages: OpenRouterMessage[]): Promise<string>;
}

export interface GuidancePromptInput {
  target: UiTarget;
  validation: ValidationResult;
  candidates: UiCandidate[];
  patchPlan?: PatchPlan;
}

export interface AiGuidanceResult {
  provider: "openrouter";
  model: string;
  summary: string;
  recommendedAction: string;
  rawText?: string;
  warning?: string;
}

export interface StatePlanPromptInput {
  states: unknown[];
  loginIndicators: unknown[];
  allowedOrigin?: string;
  mode: "manual" | "assist" | "execute";
}

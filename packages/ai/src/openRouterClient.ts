import type { AiGuidanceClient, OpenRouterMessage, OpenRouterOptions } from "./types.js";

export interface RequiredOpenRouterOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  fetchImpl: typeof fetch;
}

export function resolveOpenRouterOptions(options: OpenRouterOptions = {}): RequiredOpenRouterOptions {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for AI guidance");
  return {
    apiKey,
    model: options.model || process.env.UIHEAL_AI_MODEL || "openrouter/auto",
    baseUrl: options.baseUrl || "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: options.maxTokens || Number(process.env.UIHEAL_AI_MAX_TOKENS || 700),
    fetchImpl: options.fetchImpl || fetch
  };
}

export function createOpenRouterClient(options: OpenRouterOptions = {}): AiGuidanceClient {
  const resolved = resolveOpenRouterOptions(options);
  return {
    async complete(messages: OpenRouterMessage[]): Promise<string> {
      const response = await resolved.fetchImpl(resolved.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolved.apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "UIHeal"
        },
        body: JSON.stringify({
          model: resolved.model,
          messages,
          max_tokens: resolved.maxTokens
        })
      });
      if (!response.ok) {
        const body = await response.text();
        let detail = body.slice(0, 500);
        try {
          const json = JSON.parse(body) as { error?: { message?: string } };
          detail = json.error?.message || detail;
        } catch {
          // Keep raw body snippet.
        }
        throw new Error(`OpenRouter request failed with HTTP ${response.status}: ${detail}`);
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return json.choices?.[0]?.message?.content ?? "";
    }
  };
}

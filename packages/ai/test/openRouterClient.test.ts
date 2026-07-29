import { describe, expect, it } from "vitest";
import { createOpenRouterClient, resolveOpenRouterOptions } from "../src/index.js";

describe("OpenRouter client", () => {
  it("resolves defaults", () => {
    const options = resolveOpenRouterOptions({ apiKey: "key" });
    expect(options.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.model).toBe("openrouter/auto");
    expect(options.maxTokens).toBe(700);
  });

  it("posts OpenAI-compatible messages", async () => {
    const calls: any[] = [];
    const client = createOpenRouterClient({
      apiKey: "key",
      model: "openrouter/auto",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }
    });
    await expect(client.complete([{ role: "user", content: "hello" }])).resolves.toBe("ok");
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].init.headers.Authorization).toBe("Bearer key");
    expect(JSON.parse(calls[0].init.body).max_tokens).toBe(700);
  });

  it("includes OpenRouter error details", async () => {
    const client = createOpenRouterClient({
      apiKey: "key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "Rate limited" } }), { status: 429 })
    });

    await expect(client.complete([{ role: "user", content: "hello" }])).rejects.toThrow("Rate limited");
  });

  it("throws when API key is missing", () => {
    expect(() => resolveOpenRouterOptions({ apiKey: "" })).toThrow("OPENROUTER_API_KEY");
  });
});

import { describe, expect, it } from "vitest";
import { createOpenRouterClient, resolveOpenRouterOptions } from "../src/index.js";

describe("OpenRouter client", () => {
  it("resolves defaults", () => {
    const options = resolveOpenRouterOptions({ apiKey: "key" });
    expect(options.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.model).toBe("openrouter/auto");
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
  });

  it("throws when API key is missing", () => {
    expect(() => resolveOpenRouterOptions({ apiKey: "" })).toThrow("OPENROUTER_API_KEY");
  });
});

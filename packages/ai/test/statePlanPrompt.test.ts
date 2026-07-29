import { describe, expect, it } from "vitest";
import { buildStatePlanPrompt } from "../src/index.js";

describe("state plan prompt", () => {
  it("asks for reviewable Playwright plan without secrets", () => {
    const messages = buildStatePlanPrompt({
      mode: "assist",
      allowedOrigin: "https://portal",
      states: [{ stateId: "/login" }, { stateId: "/dashboard" }],
      loginIndicators: [{ password: "secret", selector: "input[type='password']" }]
    });
    const text = JSON.stringify(messages);
    expect(text).toContain("Playwright");
    expect(text).toContain("human review");
    expect(text).not.toContain('"password":"secret"');
    expect(text).not.toContain('"password": "secret"');
  });
});

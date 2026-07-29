import { describe, expect, it } from "vitest";
import { buildGuidancePrompt } from "../src/index.js";

describe("guidance prompt", () => {
  it("builds compact redacted evidence prompt", () => {
    const messages = buildGuidancePrompt({
      target: {
        id: "email",
        sourceTool: "a360",
        selectors: [{ kind: "css", value: "#old", enabled: true }],
        element: { tag: "input", name: "email" },
        metadata: { authToken: "secret" }
      },
      validation: { targetId: "email", status: "repairable", confidence: 0.71, signals: [], reason: "selector failed" },
      candidates: [
        { candidateId: "c1", selector: { kind: "css", value: "input[name='email']", enabled: true }, element: { tag: "input", name: "email" } }
      ]
    });
    const text = JSON.stringify(messages);
    expect(text).toContain("repairable");
    expect(text).toContain("input[name='email']");
    expect(text).not.toContain("authToken");
    expect(text).not.toContain('"secret"');
  });
});

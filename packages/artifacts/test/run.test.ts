import { describe, expect, it } from "vitest";
import { createUIHealRun, redactSecrets, uiHealRunSchema } from "../src/index.js";

describe("UIHealRun artifacts", () => {
  it("creates a schema-valid redacted run", () => {
    const run = createUIHealRun({
      mode: "analyze",
      source: { tool: "generic", kind: "inline", ref: "fixture" },
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "#email", enabled: true }],
          element: { tag: "input", name: "email" },
          metadata: { authToken: "secret-token" }
        }
      ],
      candidatesByTargetId: {
        email: [
          {
            candidateId: "c1",
            selector: { kind: "css", value: "#email", enabled: true },
            element: { tag: "input", name: "email" }
          }
        ]
      }
    });

    expect(uiHealRunSchema.parse(run).outputs.summary.total).toBe(1);
    expect(JSON.stringify(run)).not.toContain("secret-token");
  });

  it("redacts secret-like keys and values", () => {
    expect(redactSecrets({ headers: { Authorization: "Bearer abc" }, value: "sk-test" })).toEqual({
      headers: { Authorization: "[redacted]" },
      value: "[redacted]"
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildCandidateDiscoveryExpression } from "../src/index.js";

describe("candidate discovery", () => {
  it("builds a script with multiple discovery strategies", () => {
    const expression = buildCandidateDiscoveryExpression({
      id: "email",
      sourceTool: "a360",
      selectors: [{ kind: "css", value: "input#email", enabled: true }],
      element: { tag: "input", type: "email", name: "email", label: "Email:" }
    });
    expect(expression).toContain("querySelectorAll");
    expect(expression).toContain("label");
    expect(expression).toContain("input");
    expect(expression).toContain("email");
  });
});

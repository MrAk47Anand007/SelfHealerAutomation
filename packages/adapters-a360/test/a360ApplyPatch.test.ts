import { describe, expect, it } from "vitest";
import { assertApplyAllowed, buildA360SaveBotExpression } from "../src/index.js";

describe("A360 apply patch safety", () => {
  it("requires apply flag", () => {
    expect(() => assertApplyAllowed(false)).toThrow("--apply");
    expect(() => assertApplyAllowed(true)).not.toThrow();
  });

  it("builds save expression without exposing auth to Node", () => {
    const expression = buildA360SaveBotExpression("100", { nodes: [] });
    expect(expression).toContain("/v2/repository/files/100/content");
    expect(expression).toContain("localStorage.authToken");
  });
});

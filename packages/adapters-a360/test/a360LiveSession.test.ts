import { describe, expect, it } from "vitest";
import { buildA360FetchBotExpression, buildA360SessionProbeExpression } from "../src/index.js";

describe("A360 live session", () => {
  it("builds a probe expression without returning auth token", () => {
    const expression = buildA360SessionProbeExpression("100126347");
    expect(expression).toContain("localStorage.authToken");
    expect(expression).toContain("hasAuthToken");
    expect(expression).not.toContain("return auth");
  });

  it("builds a fetch expression that runs inside browser context", () => {
    const expression = buildA360FetchBotExpression("100126347");
    expect(expression).toContain("/v2/repository/files/100126347/content");
    expect(expression).toContain("X-Authorization");
  });
});

import { describe, expect, it } from "vitest";
import { createDeterministicStatePlan } from "../src/index.js";

describe("deterministic state plan", () => {
  it("generates assist script when login is required", () => {
    const plan = createDeterministicStatePlan({
      mode: "assist",
      loginRequirement: {
        required: true,
        loginState: { stateId: "/login", url: "https://portal/login", targets: [] },
        missingStates: [{ stateId: "/dashboard", url: "https://portal/dashboard", targets: [] }],
        reason: "login needed"
      }
    });
    expect(plan.required).toBe(true);
    expect(plan.script).toContain("playwright");
  });
});

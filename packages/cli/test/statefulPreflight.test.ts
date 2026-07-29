import { describe, expect, it } from "vitest";
import { planA360LivePreflight } from "../src/commands/a360Live.js";

describe("stateful preflight CLI planning", () => {
  it("maps stateful planning flags", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        stateful: "assist",
        allowOrigin: "https://portal",
        statePlanOut: "reports/state-plan.playwright.ts"
      })
    ).toMatchObject({
      stateful: {
        mode: "assist",
        allowOrigin: "https://portal",
        execute: false,
        statePlanOut: "reports/state-plan.playwright.ts"
      }
    });
  });
});

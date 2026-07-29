import { describe, expect, it } from "vitest";
import { buildAiWarningForMissingKey, planA360LivePreflight } from "../src/commands/a360Live.js";

describe("AI CLI planning", () => {
  it("maps AI guidance flags", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        ai: "guide",
        aiProvider: "openrouter",
        aiModel: "openrouter/auto",
        aiMaxTargets: "3"
      })
    ).toMatchObject({
      ai: {
        mode: "guide",
        provider: "openrouter",
        model: "openrouter/auto",
        maxTargets: 3
      }
    });
  });

  it("warns instead of failing when API key is missing", () => {
    const previous = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    expect(buildAiWarningForMissingKey({ mode: "guide" })).toBe(
      "OPENROUTER_API_KEY is missing; deterministic preflight completed without AI guidance."
    );
    process.env.OPENROUTER_API_KEY = previous;
  });
});

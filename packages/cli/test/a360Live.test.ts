import { describe, expect, it } from "vitest";
import { planA360LivePreflight } from "../src/commands/a360Live.js";

describe("A360 live preflight planning", () => {
  it("normalizes CLI options", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        fileId: "100126347",
        report: "html",
        out: "reports/a360.html"
      })
    ).toMatchObject({
      cdpPort: 9222,
      fileId: "100126347",
      reportFormat: "html",
      outPath: "reports/a360.html",
      apply: false,
      ai: {
        mode: "off",
        provider: "openrouter",
        model: "openrouter/auto",
        maxTargets: 5
      },
      stateful: {
        mode: "manual",
        execute: false
      }
    });
  });
});

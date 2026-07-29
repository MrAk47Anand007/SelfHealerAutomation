import { describe, expect, it } from "vitest";
import { createPreflightSummary, suggestRepair, type UiCandidate, type UiTarget, type ValidationResult } from "../src/index.js";

describe("repair scorer", () => {
  it("suggests the highest-confidence candidate selector", () => {
    const target: UiTarget = {
      id: "email-node",
      sourceTool: "generic",
      selectors: [{ kind: "css", value: "#old-email", enabled: true }],
      element: { tag: "input", type: "email", name: "email", label: "Email:" }
    };
    const candidates: UiCandidate[] = [
      {
        candidateId: "low",
        selector: { kind: "css", value: "input", enabled: true },
        element: { tag: "input" }
      },
      {
        candidateId: "high",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        element: { tag: "input", type: "email", name: "email", label: "Email:" }
      }
    ];
    const suggestion = suggestRepair(target, candidates);
    expect(suggestion?.selector.value).toBe("input[name='email']");
    expect(suggestion?.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("summarizes preflight statuses", () => {
    const results: ValidationResult[] = [
      { targetId: "a", status: "pass", confidence: 0.95, signals: [], reason: "ok" },
      { targetId: "b", status: "repairable", confidence: 0.7, signals: [], reason: "repair" },
      { targetId: "c", status: "failed", confidence: 0.1, signals: [], reason: "fail" }
    ];
    expect(createPreflightSummary(results)).toEqual({
      total: 3,
      pass: 1,
      repairable: 1,
      failed: 1,
      minConfidence: 0.1,
      averageConfidence: 0.5833
    });
  });
});

import { describe, expect, it } from "vitest";
import { validateTarget, type UiCandidate, type UiTarget } from "../src/index.js";

const target: UiTarget = {
  id: "email-node",
  sourceTool: "a360",
  action: "Recorder.capture",
  selectors: [{ kind: "css", value: "input#email", enabled: true }],
  url: "https://acme-test.uipath.com/login",
  frame: { url: "https://acme-test.uipath.com/login" },
  element: { tag: "input", type: "email", id: "email", name: "email", label: "Email:" },
  surroundingContext: { version: 1, target: { tag: "input", type: "email", id: "email", name: "email" } }
};

describe("validateTarget", () => {
  it("passes when candidate identity and frame match strongly", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c1",
        selector: { kind: "css", value: "input#email", enabled: true },
        url: "https://acme-test.uipath.com/login",
        frame: { url: "https://acme-test.uipath.com/login" },
        element: { tag: "input", type: "email", id: "email", name: "email", label: "Email:" },
        surroundingContext: { version: 1, target: { tag: "input", type: "email", id: "email", name: "email" } }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("pass");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("marks a target repairable when selector fails but semantic identity matches", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c2",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        url: "https://acme-test.uipath.com/login",
        frame: { url: "https://acme-test.uipath.com/login" },
        element: { tag: "input", type: "email", name: "email", label: "Email:" }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("repairable");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("fails when page frame and element identity do not match", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c3",
        url: "https://acme-test.uipath.com/work-items",
        frame: { url: "https://acme-test.uipath.com/work-items" },
        element: { tag: "table", text: "Actions WIID Description Type Status Date" }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("failed");
    expect(result.confidence).toBeLessThan(0.6);
  });
});

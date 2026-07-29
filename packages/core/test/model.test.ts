import { describe, expect, it } from "vitest";
import { normalizeSelector, selectorToLabel, type UiSelector, type UiTarget } from "../src/index.js";

describe("core model", () => {
  it("normalizes selector values without changing their meaning", () => {
    const selector: UiSelector = { kind: "css", value: "  input#email  ", enabled: true, source: "a360" };
    expect(normalizeSelector(selector)).toEqual({
      kind: "css",
      value: "input#email",
      enabled: true,
      source: "a360"
    });
  });

  it("formats selector labels for reports", () => {
    expect(selectorToLabel({ kind: "xpath", value: "//input[@id='email']", enabled: true })).toBe(
      "xpath://input[@id='email']"
    );
  });

  it("allows an A360 target to carry surrounding context", () => {
    const target: UiTarget = {
      id: "node-1",
      sourceTool: "a360",
      action: "Recorder.capture",
      selectors: [{ kind: "css", value: "input#email", enabled: true }],
      url: "https://acme-test.uipath.com/login",
      frame: { url: "https://acme-test.uipath.com/login" },
      element: { tag: "input", type: "email", name: "email" },
      surroundingContext: { version: 1, target: { tag: "input", name: "email" } },
      metadata: { nodeUid: "node-1" }
    };
    expect(target.surroundingContext?.target?.name).toBe("email");
  });
});

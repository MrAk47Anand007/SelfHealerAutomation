import { describe, expect, it } from "vitest";
import { assertStatePlanExecutionAllowed, isDestructiveActionText } from "../src/index.js";

describe("state plan safety", () => {
  it("blocks destructive action text", () => {
    expect(isDestructiveActionText("Delete user")).toBe(true);
    expect(isDestructiveActionText("Sign in")).toBe(false);
  });

  it("requires explicit execution guard", () => {
    expect(() => assertStatePlanExecutionAllowed({ execute: false, allowOrigin: "https://portal" })).toThrow("--execute-state-plan");
    expect(() => assertStatePlanExecutionAllowed({ execute: true, allowOrigin: "" })).toThrow("--allow-origin");
  });
});

import { describe, expect, it } from "vitest";
import { buildScanExpression } from "../src/index.js";

describe("buildScanExpression", () => {
  it("includes css and xpath selector probing", () => {
    const expression = buildScanExpression([
      { kind: "css", value: "input#email", enabled: true },
      { kind: "xpath", value: "//input[@id='email']", enabled: true }
    ]);
    expect(expression).toContain("document.querySelector");
    expect(expression).toContain("document.evaluate");
    expect(expression).toContain("input#email");
    expect(expression).toContain("//input[@id='email']");
  });
});

import { describe, expect, it } from "vitest";
import { createJsonPatchPlan, readJsonTargets } from "../src/index.js";

describe("json adapter", () => {
  it("reads generic targets", () => {
    const targets = readJsonTargets({
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "input#email", enabled: true }],
          element: { tag: "input", name: "email" }
        }
      ]
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("email");
  });

  it("creates a preview patch plan", () => {
    const target = readJsonTargets({
      targets: [{ id: "email", sourceTool: "generic", selectors: [], element: { tag: "input" } }]
    })[0];
    const patch = createJsonPatchPlan(target, "input[name='email']");
    expect(patch.operations[0]).toEqual({
      op: "replace",
      path: "$.targets[?id=email].selectors[0]",
      value: { kind: "css", value: "input[name='email']", enabled: true, source: "uiheal" }
    });
  });
});

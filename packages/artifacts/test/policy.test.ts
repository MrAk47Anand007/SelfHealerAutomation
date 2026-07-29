import { describe, expect, it } from "vitest";
import { createUIHealRun, evaluatePolicy } from "../src/index.js";

describe("enterprise policy", () => {
  it("blocks disallowed origins and patch apply by default", () => {
    const run = createUIHealRun({
      mode: "heal-rerun",
      source: { tool: "generic", kind: "inline", ref: "fixture" },
      targets: [
        {
          id: "delete-user",
          action: "click delete",
          sourceTool: "generic",
          url: "https://blocked.test/admin",
          selectors: [{ kind: "css", value: "button.delete", enabled: true }],
          element: { tag: "button", text: "Delete" }
        }
      ],
      patchPlans: [{ artifactType: "generic", targetId: "delete-user", operations: [], preview: "patch" }],
      policy: { allowedOrigins: ["https://allowed.test"] }
    });

    const decision = evaluatePolicy({ run });

    expect(decision.allowed).toBe(false);
    expect(decision.violations.join(" ")).toContain("not allowed");
    expect(decision.violations.join(" ")).toContain("destructive");
    expect(decision.violations.join(" ")).toContain("disabled");
  });

  it("allows non-destructive preview when policy permits apply", () => {
    const run = createUIHealRun({
      mode: "heal",
      source: { tool: "generic", kind: "inline", ref: "fixture" },
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          url: "https://allowed.test/login",
          selectors: [{ kind: "css", value: "#email", enabled: true }],
          element: { tag: "input", name: "email" }
        }
      ],
      policy: { allowedOrigins: ["https://allowed.test"], allowApply: true }
    });

    expect(evaluatePolicy({ run }).allowed).toBe(true);
  });

  it("blocks patch plans below the auto-heal confidence threshold", () => {
    const run = createUIHealRun({
      mode: "heal-rerun",
      source: { tool: "generic", kind: "inline", ref: "fixture" },
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "#email", enabled: true }],
          element: { tag: "input", name: "email" }
        }
      ],
      candidatesByTargetId: {
        email: [
          {
            candidateId: "email",
            selector: { kind: "css", value: "input[name='email']", enabled: true },
            element: { tag: "input", name: "email" }
          }
        ]
      },
      patchPlans: [{ artifactType: "generic", targetId: "email", operations: [], preview: "patch" }],
      policy: { allowApply: true, minAutoHealConfidence: 0.85 }
    });

    const decision = evaluatePolicy({ run });

    expect(decision.allowed).toBe(false);
    expect(decision.violations.join(" ")).toContain("below auto-heal threshold");
  });
});

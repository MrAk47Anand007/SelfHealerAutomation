import { describe, expect, it } from "vitest";
import { runValidateCommand } from "../src/commands/validate.js";

describe("validate command", () => {
  it("validates target catalog against candidate catalog", async () => {
    const result = await runValidateCommand({
      targets: {
        targets: [
          {
            id: "email",
            sourceTool: "generic",
            selectors: [{ kind: "css", value: "#email", enabled: true }],
            element: { tag: "input", name: "email" }
          }
        ]
      },
      candidates: [
        {
          candidateId: "c1",
          selector: { kind: "css", value: "input[name='email']", enabled: true },
          element: { tag: "input", name: "email" }
        }
      ]
    });
    expect(result.summary.total).toBe(1);
    expect(result.results[0].status).toBe("repairable");
  });
});

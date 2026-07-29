import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type A360BotContent } from "@uiheal/adapters-a360";
import { runA360Preflight } from "../src/commands/a360.js";
import { renderHtmlReport } from "../src/report/htmlReport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../../adapters-a360/fixtures/live-ui-capture-bot.min.json"), "utf8")
) as A360BotContent;

describe("A360 preflight command", () => {
  it("returns validation results and repair plans", async () => {
    const result = await runA360Preflight({
      bot: fixture,
      candidatesByTargetId: {
        "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3": [
          {
            candidateId: "candidate-1",
            selector: { kind: "css", value: "input[name='email']", enabled: true },
            element: { tag: "input", type: "email", name: "email" },
            frame: { url: "https://acme-test.uipath.com/login" }
          }
        ]
      }
    });
    expect(result.summary.total).toBe(1);
    expect(result.patchPlans).toHaveLength(1);
    expect(renderHtmlReport(result)).toContain("UIHeal A360 Preflight");
  });
});

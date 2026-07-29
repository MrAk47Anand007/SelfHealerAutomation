import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type A360BotContent, extractA360Targets } from "@uiheal/adapters-a360";
import { runA360Preflight } from "../src/commands/a360.js";
import { renderHtmlReport } from "../src/report/htmlReport.js";
import { renderJsonReport } from "../src/report/jsonReport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../../adapters-a360/fixtures/live-ui-capture-bot.min.json"), "utf8")
) as A360BotContent;

describe("offline E2E", () => {
  it("runs A360 preflight from fixture and snapshot-like candidates", async () => {
    const target = extractA360Targets(fixture)[0];
    const result = await runA360Preflight({
      bot: fixture,
      candidatesByTargetId: {
        [target.id]: [
          {
            candidateId: "offline-candidate",
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
    expect(renderJsonReport(result)).toContain("patchPlans");
  });
});

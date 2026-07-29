import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyA360PatchPreview, createA360PatchPlan, type A360BotContent } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/live-ui-capture-bot.min.json"), "utf8")
) as A360BotContent;

describe("A360 patch preview", () => {
  it("creates and applies a CSS selector replacement preview", () => {
    const plan = createA360PatchPlan(fixture, {
      targetId: "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3",
      selector: { kind: "css", value: "input[name='email']", enabled: true, source: "uiheal" },
      confidence: 0.91,
      reason: "Context matched",
      candidate: {
        candidateId: "candidate-1",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        element: { tag: "input", name: "email" }
      }
    });
    expect(plan.preview).toContain("CSS Selector");
    const patched = applyA360PatchPreview(fixture, plan);
    const criteria = patched.nodes?.[0].attributes?.[0].value.uiObject?.criteria;
    expect(criteria?.["CSS Selector"].value.string).toBe("input[name='email']");
  });
});

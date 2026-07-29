import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractA360Targets, type A360BotContent } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/live-ui-capture-bot.min.json"), "utf8")
) as A360BotContent;

describe("A360 bot adapter", () => {
  it("extracts Recorder UIOBJECT as UiTarget", () => {
    const targets = extractA360Targets(fixture);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      id: "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3",
      sourceTool: "a360",
      action: "Recorder.capture",
      url: "https://acme-test.uipath.com/login",
      element: { tag: "input", type: "email", id: "email", name: "email" }
    });
    expect(targets[0].selectors.map((selector) => selector.kind)).toContain("css");
    expect(targets[0].surroundingContext?.target?.name).toBe("email");
  });
});

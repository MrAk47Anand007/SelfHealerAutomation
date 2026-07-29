import { describe, expect, it } from "vitest";
import { extractPuppeteerTargets } from "../src/index.js";

describe("Puppeteer adapter", () => {
  it("extracts CSS selectors", () => {
    const source = `
      await page.waitForSelector("#email");
      await page.$("button.login");
    `;
    const targets = extractPuppeteerTargets(source, "login.js");
    expect(targets.map((target) => target.selectors[0].value)).toEqual(["#email", "button.login"]);
  });
});

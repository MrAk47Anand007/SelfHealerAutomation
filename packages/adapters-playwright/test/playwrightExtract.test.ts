import { describe, expect, it } from "vitest";
import { extractPlaywrightTargets } from "../src/index.js";

describe("Playwright adapter", () => {
  it("extracts common locators", () => {
    const source = `
      await page.locator("#email").fill("a@b.com");
      await page.getByRole("button", { name: "Login" }).click();
      await page.getByLabel("Password").fill("secret");
    `;
    const targets = extractPlaywrightTargets(source, "login.spec.ts");
    expect(targets.map((target) => target.selectors[0].kind)).toEqual(["css", "role", "text"]);
  });
});

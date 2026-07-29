import { describe, expect, it } from "vitest";
import { extractSeleniumTargets } from "../src/index.js";

describe("Selenium adapter", () => {
  it("extracts Selenium By selectors", () => {
    const source = `
      driver.find_element(By.ID, "email")
      driver.find_element(By.CSS_SELECTOR, "button.login")
      driver.find_element(By.XPATH, "//input[@name='password']")
    `;
    const targets = extractSeleniumTargets(source, "login.py");
    expect(targets.map((target) => target.selectors[0].kind)).toEqual(["id", "css", "xpath"]);
  });
});

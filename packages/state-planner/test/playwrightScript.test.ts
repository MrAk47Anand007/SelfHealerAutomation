import { describe, expect, it } from "vitest";
import { generatePlaywrightSetupScript } from "../src/index.js";

describe("Playwright setup script", () => {
  it("uses environment variables for credentials", () => {
    const script = generatePlaywrightSetupScript({
      loginUrl: "https://portal/login",
      usernameSelector: "input[name='email']",
      passwordSelector: "input[name='password']",
      submitSelector: "button[type='submit']",
      expectedUrlPattern: "**/dashboard"
    });
    expect(script).toContain("process.env.UIHEAL_LOGIN_USER");
    expect(script).toContain("process.env.UIHEAL_LOGIN_PASS");
    expect(script).toContain("page.waitForURL");
  });
});

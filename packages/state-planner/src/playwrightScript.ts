export interface PlaywrightSetupInput {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  expectedUrlPattern?: string;
}

export function generatePlaywrightSetupScript(input: PlaywrightSetupInput): string {
  return `import { chromium } from "playwright";

const user = process.env.UIHEAL_LOGIN_USER;
const pass = process.env.UIHEAL_LOGIN_PASS;
if (!user || !pass) throw new Error("UIHEAL_LOGIN_USER and UIHEAL_LOGIN_PASS are required");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto(${JSON.stringify(input.loginUrl)});
await page.fill(${JSON.stringify(input.usernameSelector)}, user);
await page.fill(${JSON.stringify(input.passwordSelector)}, pass);
await page.click(${JSON.stringify(input.submitSelector)});
${input.expectedUrlPattern ? `await page.waitForURL(${JSON.stringify(input.expectedUrlPattern)});` : ""}
`;
}

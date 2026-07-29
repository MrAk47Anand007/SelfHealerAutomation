import { chromium } from "playwright";

const user = process.env.UIHEAL_LOGIN_USER;
const pass = process.env.UIHEAL_LOGIN_PASS;
if (!user || !pass) throw new Error("UIHEAL_LOGIN_USER and UIHEAL_LOGIN_PASS are required");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://portal.example.com/login");
await page.fill("input[name='email']", user);
await page.fill("input[type='password']", pass);
await page.click("button[type='submit']");
await page.waitForURL("**/dashboard");

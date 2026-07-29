import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { buildCandidateDiscoveryExpression } from "@uiheal/cdp";
import type { UiCandidate } from "@uiheal/core";
import type { UiTargetStateGroup } from "@uiheal/state-planner";

interface PlaywrightLike {
  chromium: {
    launch(options: { headless: boolean }): Promise<BrowserLike>;
  };
}

interface BrowserLike {
  newContext(options?: Record<string, unknown>): Promise<BrowserContextLike>;
  close(): Promise<void>;
}

interface BrowserContextLike {
  newPage(): Promise<PageLike>;
  storageState(options: { path: string }): Promise<unknown>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  fill(selector: string, value: string): Promise<unknown>;
  click(selector: string): Promise<unknown>;
  waitForURL(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state: string, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(expression: string): Promise<T>;
  url(): string;
}

export interface PlaywrightLoginSelectors {
  username: string;
  password: string;
  submit: string;
  expectedUrlPattern?: string;
}

export interface PlaywrightStateExecutionInput {
  loginUrl: string;
  allowOrigin: string;
  storageStatePath: string;
  headless: boolean;
  selectors: PlaywrightLoginSelectors;
  missingGroups: UiTargetStateGroup[];
}

export interface PlaywrightStateExecutionResult {
  storageStatePath: string;
  scannedUrls: string[];
  candidatesByTargetId: Record<string, UiCandidate[]>;
}

function assertAllowedUrl(url: string, allowOrigin: string): void {
  const parsed = new URL(url);
  if (parsed.origin !== allowOrigin) {
    throw new Error(`Refusing Playwright state execution for ${parsed.origin}; allowed origin is ${allowOrigin}`);
  }
}

async function resolvePlaywright(automation?: PlaywrightLike): Promise<PlaywrightLike> {
  if (automation) return automation;
  return (await import("playwright")) as PlaywrightLike;
}

async function waitForPageSettled(page: PageLike): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch {
    await page.waitForLoadState("load", { timeout: 15000 }).catch(() => undefined);
  }
  await page
    .evaluate<boolean>("document.readyState !== 'loading' && Boolean(document.body)")
    .catch(() => false);
}

function isBroadUrlPattern(pattern: string | undefined): boolean {
  return !pattern || pattern === "*" || pattern === "**" || pattern === "**/*" || pattern === ".*";
}

function isLoginLikeUrl(currentUrl: string, loginUrl: string): boolean {
  const current = new URL(currentUrl);
  const login = new URL(loginUrl);
  if (current.origin !== login.origin) return false;
  if (current.pathname === login.pathname) return true;
  return /\/(login|signin|sign-in|auth)(\/|$)/i.test(current.pathname);
}

async function readSafePageText(page: PageLike): Promise<string | undefined> {
  const text = await page
    .evaluate<string>("document.body ? document.body.innerText.slice(0, 1000) : ''")
    .catch(() => "");
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

function loginFailureHint(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(
    /(these credentials do not match our records|invalid [^.?!]{0,120}|incorrect [^.?!]{0,120}|login failed[^.?!]{0,120}|authentication failed[^.?!]{0,120})/i
  );
  return match?.[0]?.trim().slice(0, 180);
}

async function assertAuthenticatedProbe(page: PageLike, loginUrl: string, probeUrl?: string): Promise<void> {
  if (!probeUrl) {
    if (isLoginLikeUrl(page.url(), loginUrl)) {
      const hint = loginFailureHint(await readSafePageText(page));
      throw new Error(`Login did not authenticate; still on login page.${hint ? ` Page says: ${hint}` : ""}`);
    }
    return;
  }
  await page.goto(probeUrl, { waitUntil: "domcontentloaded" });
  await waitForPageSettled(page);
  if (isLoginLikeUrl(page.url(), loginUrl)) {
    const hint = loginFailureHint(await readSafePageText(page));
    throw new Error(
      `Login did not authenticate; ${probeUrl} redirected back to login.${hint ? ` Page says: ${hint}` : ""}`
    );
  }
}

export async function executePlaywrightStateScan(
  input: PlaywrightStateExecutionInput,
  automation?: PlaywrightLike
): Promise<PlaywrightStateExecutionResult> {
  const user = process.env.UIHEAL_LOGIN_USER;
  const pass = process.env.UIHEAL_LOGIN_PASS;
  if (!user || !pass) throw new Error("UIHEAL_LOGIN_USER and UIHEAL_LOGIN_PASS are required for stateful execution");

  assertAllowedUrl(input.loginUrl, input.allowOrigin);
  for (const group of input.missingGroups) {
    if (group.url) assertAllowedUrl(group.url, input.allowOrigin);
  }

  await mkdir(dirname(input.storageStatePath), { recursive: true });
  const playwright = await resolvePlaywright(automation);
  const browser = await playwright.chromium.launch({ headless: input.headless });
  const candidatesByTargetId: Record<string, UiCandidate[]> = {};
  const scannedUrls: string[] = [];

  try {
    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();
    await loginPage.goto(input.loginUrl, { waitUntil: "domcontentloaded" });
    await waitForPageSettled(loginPage);
    await loginPage.fill(input.selectors.username, user);
    await loginPage.fill(input.selectors.password, pass);
    await loginPage.click(input.selectors.submit);
    const expectedUrlPattern = input.selectors.expectedUrlPattern;
    if (expectedUrlPattern && !isBroadUrlPattern(expectedUrlPattern)) {
      await loginPage.waitForURL(expectedUrlPattern, { timeout: 30000 });
    }
    await waitForPageSettled(loginPage);
    await assertAuthenticatedProbe(loginPage, input.loginUrl, input.missingGroups.find((group) => group.url)?.url);
    await loginContext.storageState({ path: input.storageStatePath });
    await loginContext.close();

    const scanContext = await browser.newContext({ storageState: input.storageStatePath });
    try {
      for (const group of input.missingGroups) {
        if (!group.url) continue;
        const page = await scanContext.newPage();
        await page.goto(group.url, { waitUntil: "domcontentloaded" });
        await waitForPageSettled(page);
        scannedUrls.push(group.url);
        for (const target of group.targets) {
          candidatesByTargetId[target.id] = await page.evaluate<UiCandidate[]>(buildCandidateDiscoveryExpression(target));
        }
      }
    } finally {
      await scanContext.close();
    }
  } finally {
    await browser.close();
  }

  return { storageStatePath: input.storageStatePath, scannedUrls, candidatesByTargetId };
}

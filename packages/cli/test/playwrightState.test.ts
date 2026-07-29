import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executePlaywrightStateScan } from "../src/stateful/playwrightState.js";

function createAutomation() {
  const calls: string[] = [];
  let currentUrl = "about:blank";
  const page = {
    goto: async (url: string) => {
      calls.push(`goto:${url}`);
      currentUrl = url;
    },
    fill: async (selector: string) => {
      calls.push(`fill:${selector}`);
    },
    click: async (selector: string) => {
      calls.push(`click:${selector}`);
      currentUrl = "https://portal.test/dashboard";
    },
    waitForURL: async (url: string) => {
      calls.push(`waitForURL:${url}`);
    },
    waitForLoadState: async (state: string) => {
      calls.push(`waitForLoadState:${state}`);
    },
    evaluate: async (expression: string) => {
      if (expression.includes("document.body")) return "Dashboard";
      calls.push(`evaluate:${expression.includes("button.save")}`);
      return [{ candidateId: "c1", selector: { kind: "css", value: "button.save", enabled: true } }];
    },
    url: () => currentUrl
  };
  return {
    calls,
    automation: {
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () => page,
            storageState: async () => {
              calls.push("storageState");
            },
            close: async () => {
              calls.push("context.close");
            }
          }),
          close: async () => {
            calls.push("browser.close");
          }
        })
      }
    }
  };
}

describe("executePlaywrightStateScan", () => {
  it("logs in, saves storage state, and scans missing groups", async () => {
    const previousUser = process.env.UIHEAL_LOGIN_USER;
    const previousPass = process.env.UIHEAL_LOGIN_PASS;
    process.env.UIHEAL_LOGIN_USER = "user";
    process.env.UIHEAL_LOGIN_PASS = "pass";
    const { automation, calls } = createAutomation();
    try {
      const result = await executePlaywrightStateScan(
        {
          loginUrl: "https://portal.test/login",
          allowOrigin: "https://portal.test",
          storageStatePath: join(mkdtempSync(join(tmpdir(), "uiheal-state-")), "state.json"),
          headless: true,
          selectors: { username: "input[name='email']", password: "input[type='password']", submit: "button[type='submit']" },
          missingGroups: [
            {
              stateId: "/dashboard",
              origin: "https://portal.test",
              url: "https://portal.test/dashboard",
              targets: [
                {
                  id: "save",
                  sourceTool: "a360",
                  url: "https://portal.test/dashboard",
                  selectors: [{ kind: "css", value: "button.save", enabled: true }],
                  element: { tag: "button" }
                }
              ]
            }
          ]
        },
        automation
      );

      expect(result.storageStatePath).toContain("state.json");
      expect(result.scannedUrls).toEqual(["https://portal.test/dashboard"]);
      expect(result.candidatesByTargetId.save).toHaveLength(1);
      expect(calls).toContain("storageState");
      expect(calls).toContain("evaluate:true");
    } finally {
      if (previousUser === undefined) delete process.env.UIHEAL_LOGIN_USER;
      else process.env.UIHEAL_LOGIN_USER = previousUser;
      if (previousPass === undefined) delete process.env.UIHEAL_LOGIN_PASS;
      else process.env.UIHEAL_LOGIN_PASS = previousPass;
    }
  });

  it("fails before saving storage state when the protected page redirects to login", async () => {
    const previousUser = process.env.UIHEAL_LOGIN_USER;
    const previousPass = process.env.UIHEAL_LOGIN_PASS;
    process.env.UIHEAL_LOGIN_USER = "user";
    process.env.UIHEAL_LOGIN_PASS = "pass";
    const calls: string[] = [];
    let currentUrl = "about:blank";
    const page = {
      goto: async (url: string) => {
        calls.push(`goto:${url}`);
        currentUrl = url.endsWith("/dashboard") ? "https://portal.test/login" : url;
      },
      fill: async (selector: string) => {
        calls.push(`fill:${selector}`);
      },
      click: async (selector: string) => {
        calls.push(`click:${selector}`);
      },
      waitForURL: async (url: string) => {
        calls.push(`waitForURL:${url}`);
      },
      waitForLoadState: async (state: string) => {
        calls.push(`waitForLoadState:${state}`);
      },
      evaluate: async (expression: string) => {
        if (expression.includes("document.body")) return "These credentials do not match our records.";
        return [];
      },
      url: () => currentUrl
    };
    const automation = {
      chromium: {
        launch: async () => ({
          newContext: async () => ({
            newPage: async () => page,
            storageState: async () => {
              calls.push("storageState");
            },
            close: async () => {
              calls.push("context.close");
            }
          }),
          close: async () => {
            calls.push("browser.close");
          }
        })
      }
    };

    try {
      await expect(
        executePlaywrightStateScan(
          {
            loginUrl: "https://portal.test/login",
            allowOrigin: "https://portal.test",
            storageStatePath: join(mkdtempSync(join(tmpdir(), "uiheal-state-")), "state.json"),
            headless: true,
            selectors: {
              username: "input[name='email']",
              password: "input[type='password']",
              submit: "button[type='submit']",
              expectedUrlPattern: "**/*"
            },
            missingGroups: [
              {
                stateId: "/dashboard",
                origin: "https://portal.test",
                url: "https://portal.test/dashboard",
                targets: []
              }
            ]
          },
          automation
        )
      ).rejects.toThrow("redirected back to login");
      expect(calls).not.toContain("storageState");
      expect(calls).not.toContain("waitForURL:**/*");
    } finally {
      if (previousUser === undefined) delete process.env.UIHEAL_LOGIN_USER;
      else process.env.UIHEAL_LOGIN_USER = previousUser;
      if (previousPass === undefined) delete process.env.UIHEAL_LOGIN_PASS;
      else process.env.UIHEAL_LOGIN_PASS = previousPass;
    }
  });

  it("refuses origins outside the allowlist", async () => {
    const previousUser = process.env.UIHEAL_LOGIN_USER;
    const previousPass = process.env.UIHEAL_LOGIN_PASS;
    process.env.UIHEAL_LOGIN_USER = "user";
    process.env.UIHEAL_LOGIN_PASS = "pass";

    try {
      await expect(
        executePlaywrightStateScan({
          loginUrl: "https://other.test/login",
          allowOrigin: "https://portal.test",
          storageStatePath: "reports/state.json",
          headless: true,
          selectors: { username: "input", password: "input[type='password']", submit: "button" },
          missingGroups: []
        })
      ).rejects.toThrow("allowed origin");
    } finally {
      if (previousUser === undefined) delete process.env.UIHEAL_LOGIN_USER;
      else process.env.UIHEAL_LOGIN_USER = previousUser;
      if (previousPass === undefined) delete process.env.UIHEAL_LOGIN_PASS;
      else process.env.UIHEAL_LOGIN_PASS = previousPass;
    }
  });
});

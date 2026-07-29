import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executePlaywrightStateScan } from "../src/stateful/playwrightState.js";

function createAutomation() {
  const calls: string[] = [];
  const page = {
    goto: async (url: string) => {
      calls.push(`goto:${url}`);
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
      calls.push(`evaluate:${expression.includes("button.save")}`);
      return [{ candidateId: "c1", selector: { kind: "css", value: "button.save", enabled: true } }];
    }
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

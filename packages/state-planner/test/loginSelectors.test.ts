import { describe, expect, it } from "vitest";
import { inferLoginSelectors } from "../src/index.js";

describe("inferLoginSelectors", () => {
  it("infers login selectors and expected post-login URL from recorded targets", () => {
    const selectors = inferLoginSelectors({
      loginState: {
        stateId: "/login",
        origin: "https://portal.test",
        url: "https://portal.test/login",
        targets: [
          {
            id: "email",
            sourceTool: "a360",
            action: "Recorder.capture",
            url: "https://portal.test/login",
            selectors: [{ kind: "css", value: "input#email", enabled: true }],
            element: { tag: "input", type: "email", id: "email", name: "email" }
          },
          {
            id: "password",
            sourceTool: "a360",
            action: "Recorder.capture",
            url: "https://portal.test/login",
            selectors: [{ kind: "name", value: "password", enabled: true }],
            element: { tag: "input", type: "password", name: "password" }
          },
          {
            id: "login",
            sourceTool: "a360",
            action: "Recorder.click",
            url: "https://portal.test/login",
            selectors: [{ kind: "css", value: "button.login", enabled: true }],
            element: { tag: "button", text: "Login" }
          }
        ]
      },
      missingStates: [
        {
          stateId: "/work-items",
          origin: "https://portal.test",
          url: "https://portal.test/work-items",
          targets: []
        }
      ]
    });

    expect(selectors.username).toBe("input#email");
    expect(selectors.password).toBe('[name="password"]');
    expect(selectors.submit).toBe("button.login");
    expect(selectors.expectedUrlPattern).toBe("**/work-items*");
  });
});

import { describe, expect, it } from "vitest";
import { findA360Page, findTargetPages, pickDefaultContext, pickExtensionContext } from "../src/index.js";

describe("CDP page discovery", () => {
  const pages = [
    {
      id: "1",
      type: "page",
      title: "Bot",
      url: "https://aa/#/bots/repository/private/files/task/100/edit",
      webSocketDebuggerUrl: "ws://a"
    },
    {
      id: "2",
      type: "page",
      title: "ACME",
      url: "https://acme-test.uipath.com/login",
      webSocketDebuggerUrl: "ws://b"
    }
  ];

  it("finds A360 bot editor page by file id", () => {
    expect(findA360Page(pages, "100")?.id).toBe("1");
  });

  it("finds target pages by URL prefix", () => {
    expect(findTargetPages(pages, ["https://acme-test.uipath.com/login"])).toHaveLength(1);
  });

  it("picks default and extension contexts", () => {
    const contexts = [
      { id: 4, name: "", origin: "https://aa", type: "default" },
      { id: 6, name: "Automation 360", origin: "chrome-extension://abc", type: "isolated" }
    ];
    expect(pickDefaultContext(contexts, "https://aa")?.id).toBe(4);
    expect(pickExtensionContext(contexts, "Automation 360")?.id).toBe(6);
  });
});

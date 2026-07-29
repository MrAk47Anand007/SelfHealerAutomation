import { describe, expect, it } from "vitest";
import { groupTargetsByState } from "../src/index.js";

describe("state grouping", () => {
  it("groups targets by URL path", () => {
    const groups = groupTargetsByState([
      { id: "login-email", sourceTool: "a360", selectors: [], url: "https://portal/login", element: { tag: "input" } },
      { id: "work-table", sourceTool: "a360", selectors: [], url: "https://portal/work-items", element: { tag: "table" } }
    ]);
    expect(groups.map((group) => group.stateId)).toEqual(["/login", "/work-items"]);
  });
});

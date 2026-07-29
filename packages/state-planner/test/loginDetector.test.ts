import { describe, expect, it } from "vitest";
import { detectLoginRequirement } from "../src/index.js";

describe("login detector", () => {
  it("detects post-login state missing when only login page is open", () => {
    const result = detectLoginRequirement(
      [
        { stateId: "/login", origin: "https://portal", url: "https://portal/login", targets: [] },
        { stateId: "/dashboard", origin: "https://portal", url: "https://portal/dashboard", targets: [] }
      ],
      ["https://portal/login"]
    );
    expect(result.required).toBe(true);
    expect(result.missingStates.map((state) => state.stateId)).toEqual(["/dashboard"]);
  });
});

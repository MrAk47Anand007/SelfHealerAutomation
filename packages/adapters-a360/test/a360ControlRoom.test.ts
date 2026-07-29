import { describe, expect, it } from "vitest";
import { buildA360ContentUrl, redactHeaders } from "../src/index.js";

describe("A360 Control Room helpers", () => {
  it("builds the bot content URL", () => {
    expect(buildA360ContentUrl("https://example.controlroom", "100126347")).toBe(
      "https://example.controlroom/v2/repository/files/100126347/content"
    );
  });

  it("redacts sensitive headers", () => {
    expect(
      redactHeaders({
        "X-Authorization": "secret",
        Cookie: "session=secret",
        Accept: "application/json"
      })
    ).toEqual({
      "X-Authorization": "[REDACTED]",
      Cookie: "[REDACTED]",
      Accept: "application/json"
    });
  });
});

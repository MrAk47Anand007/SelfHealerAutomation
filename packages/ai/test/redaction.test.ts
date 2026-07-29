import { describe, expect, it } from "vitest";
import { redactGuidanceEvidence, redactText } from "../src/index.js";

describe("AI redaction", () => {
  it("redacts token-like text", () => {
    expect(redactText("Authorization: Bearer abc123")).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts sensitive object keys recursively", () => {
    expect(
      redactGuidanceEvidence({
        headers: { Cookie: "session=secret", Accept: "json" },
        password: "secret",
        selector: "input#email"
      })
    ).toEqual({
      headers: { Cookie: "[REDACTED]", Accept: "json" },
      password: "[REDACTED]",
      selector: "input#email"
    });
  });
});

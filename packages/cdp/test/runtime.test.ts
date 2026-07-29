import { describe, expect, it } from "vitest";
import { extractRuntimeValue } from "../src/index.js";

describe("CDP runtime helpers", () => {
  it("extracts returnByValue results", () => {
    expect(extractRuntimeValue({ result: { result: { value: { ok: true } } } })).toEqual({ ok: true });
  });

  it("throws for CDP exceptionDetails", () => {
    expect(() =>
      extractRuntimeValue({
        result: {
          exceptionDetails: {
            text: "Evaluation failed"
          }
        }
      })
    ).toThrow("Evaluation failed");
  });
});

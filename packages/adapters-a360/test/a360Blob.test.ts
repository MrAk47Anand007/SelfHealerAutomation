import { describe, expect, it } from "vitest";
import { decodeA360Blob, encodeA360Blob, summarizeA360Blob } from "../src/index.js";

describe("A360 blob", () => {
  it("round trips decoded blob JSON", () => {
    const input = { objNode: { name: "email" }, captureVersion: 5700 };
    const encoded = encodeA360Blob(input);
    expect(decodeA360Blob(encoded)).toEqual(input);
  });

  it("summarizes decoded blob metadata without expanding full advanced context", () => {
    expect(
      summarizeA360Blob({
        objNode: { uniqueID: "node-1", name: "email", path: { objPath: [{ index: 2 }] } },
        captureVersion: 5700,
        advanceProperties: {
          additionalProperties: {
            aa_genai_surroundingContext: "{\"version\":1}",
            secretLikePayload: "do-not-copy"
          }
        }
      })
    ).toEqual({
      captureVersion: 5700,
      topLevelKeys: ["advanceProperties", "captureVersion", "objNode"],
      objNode: { uniqueID: "node-1", name: "email", pathDepth: 1 },
      additionalPropertyKeys: ["aa_genai_surroundingContext", "secretLikePayload"],
      hasSurroundingContext: true
    });
  });
});

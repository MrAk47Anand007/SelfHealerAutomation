import { describe, expect, it } from "vitest";
import { decodeA360Blob, encodeA360Blob } from "../src/index.js";

describe("A360 blob", () => {
  it("round trips decoded blob JSON", () => {
    const input = { objNode: { name: "email" }, captureVersion: 5700 };
    const encoded = encodeA360Blob(input);
    expect(decodeA360Blob(encoded)).toEqual(input);
  });
});

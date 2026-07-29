import { describe, expect, it } from "vitest";
import { createSnapshotPayload } from "../src/commands/snapshot.js";

describe("snapshot mode", () => {
  it("creates a portable snapshot payload", () => {
    const snapshot = createSnapshotPayload(
      [{ candidateId: "c1", element: { tag: "input", name: "email" }, url: "https://portal/login" }],
      { source: "cdp" }
    );
    expect(snapshot.version).toBe(1);
    expect(snapshot.candidates).toHaveLength(1);
  });
});

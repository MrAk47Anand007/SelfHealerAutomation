import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadLocalEnv } from "../src/env.js";

describe("loadLocalEnv", () => {
  it("loads .env values without overriding existing environment variables", () => {
    const dir = join(tmpdir(), `uiheal-env-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const previousKey = process.env.OPENROUTER_API_KEY;
    const previousModel = process.env.UIHEAL_AI_MODEL;
    try {
      process.env.OPENROUTER_API_KEY = "already-set";
      delete process.env.UIHEAL_AI_MODEL;
      writeFileSync(join(dir, ".env"), "OPENROUTER_API_KEY=from-file\nUIHEAL_AI_MODEL='test-model'\n");

      loadLocalEnv(dir);

      expect(process.env.OPENROUTER_API_KEY).toBe("already-set");
      expect(process.env.UIHEAL_AI_MODEL).toBe("test-model");
    } finally {
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.UIHEAL_AI_MODEL;
      else process.env.UIHEAL_AI_MODEL = previousModel;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

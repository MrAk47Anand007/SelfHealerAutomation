import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRunArtifact, healRerun, inspectRun, renderRunReport, writeRunArtifact } from "../src/commands/run.js";

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

describe("enterprise run commands", () => {
  it("creates a universal run from generic targets and candidates", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uiheal-run-"));
    const targetsPath = join(dir, "targets.json");
    const candidatesPath = join(dir, "candidates.json");
    writeJson(targetsPath, {
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "#old-email", enabled: true }],
          url: "https://portal.test/login",
          element: { tag: "input", name: "email" }
        }
      ]
    });
    writeJson(candidatesPath, {
      candidatesByTargetId: {
        email: [
          {
            candidateId: "email-new",
            selector: { kind: "css", value: "input[name='email']", enabled: true },
            url: "https://portal.test/login",
            element: { tag: "input", name: "email" }
          }
        ]
      }
    });

    const run = await createRunArtifact({
      tool: "generic",
      targets: targetsPath,
      candidates: candidatesPath,
      policy: undefined
    });

    expect(run.schemaVersion).toBe(1);
    expect(run.outputs.summary.total).toBe(1);
    expect(run.outputs.patchPlans[0].preview).toContain("input[name='email']");
  });

  it("writes, inspects, reports, and heal-reruns a run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uiheal-run-"));
    const targetsPath = join(dir, "targets.json");
    const runPath = join(dir, "run.json");
    const healedPath = join(dir, "healed.json");
    const backupDir = join(dir, "backups");
    writeJson(targetsPath, {
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "#email", enabled: true }],
          url: "https://portal.test/login",
          element: { tag: "input", name: "email" }
        }
      ]
    });

    await writeRunArtifact({ tool: "generic", targets: targetsPath, out: runPath });
    const inspect = await inspectRun({ run: runPath });
    const html = await renderRunReport({ run: runPath, report: "html" });
    const healed = await healRerun({ run: runPath, allowOrigin: "https://portal.test", backupDir, out: healedPath });

    expect(inspect.tool).toBe("generic");
    expect(html).toContain("UIHeal Enterprise Run");
    expect(healed.mode).toBe("heal-rerun");
    expect(healed.outputs.patchResult?.backup?.path).toContain("targets.json");
    expect(readFileSync(healedPath, "utf8")).toContain("patchResult");
  });
});

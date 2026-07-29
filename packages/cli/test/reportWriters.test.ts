import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderHtmlReport } from "../src/report/htmlReport.js";
import { renderJsonReport } from "../src/report/jsonReport.js";
import { writeReportFile } from "../src/report/writeReport.js";

describe("report writers", () => {
  it("renders pretty JSON", () => {
    expect(renderJsonReport({ ok: true })).toContain('"ok": true');
  });

  it("renders AI guidance in HTML reports", () => {
    const html = renderHtmlReport({
      results: [],
      patchPlans: [],
      summary: { total: 0, pass: 0, repairable: 0, failed: 0 },
      aiGuidance: [{ targetId: "target-1", model: "test-model", rawText: "<repair>" }]
    });

    expect(html).toContain("AI Guidance");
    expect(html).toContain("test-model");
    expect(html).toContain("&lt;repair&gt;");
  });

  it("writes report file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uiheal-"));
    const path = join(dir, "report.html");
    await writeReportFile(path, "<h1>ok</h1>");
    expect(readFileSync(path, "utf8")).toBe("<h1>ok</h1>");
  });
});

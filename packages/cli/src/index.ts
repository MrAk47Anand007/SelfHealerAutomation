#!/usr/bin/env node
import { Command } from "commander";
import { runA360LivePreflight } from "./commands/a360Live.js";
import { scanPlaywrightFile } from "./commands/playwright.js";
import { scanPuppeteerFile } from "./commands/puppeteer.js";
import { scanSeleniumFile } from "./commands/selenium.js";
import { createSnapshotPayload } from "./commands/snapshot.js";
import { writeJsonFile } from "./io/readWriteJson.js";
import { renderHtmlReport } from "./report/htmlReport.js";
import { renderJsonReport } from "./report/jsonReport.js";
import { writeReportFile } from "./report/writeReport.js";
import { loadLocalEnv } from "./env.js";

loadLocalEnv();

const program = new Command();

program.name("uiheal").description("Local-first UI automation preflight and healing CLI").version("0.1.0");

const a360 = program.command("a360").description("Automation Anywhere A360 commands");

a360
  .command("preflight")
  .description("Run live A360 Recorder UI target preflight through local Chrome CDP")
  .requiredOption("--cdp <port>", "Chrome remote debugging port")
  .option("--file-id <fileId>", "A360 bot file id")
  .option("--report <format>", "Report format: html or json", "html")
  .option("--out <path>", "Write report to a file")
  .option("--apply", "Apply changes instead of previewing", false)
  .option("--ai <mode>", "AI mode: off, guide, or plan", "off")
  .option("--ai-provider <provider>", "AI provider", "openrouter")
  .option("--ai-model <model>", "AI model slug")
  .option("--ai-max-targets <number>", "Maximum targets to send for AI guidance", "5")
  .option("--stateful <mode>", "Stateful mode: manual, assist, or execute", "manual")
  .option("--allow-origin <origin>", "Allowed origin for state-plan execution")
  .option("--execute-state-plan", "Execute state plan after safety checks", false)
  .option("--state-plan-out <path>", "Write generated state plan script to a file")
  .action(async (options) => {
    const result = await runA360LivePreflight(options);
    const content = options.report === "json" ? renderJsonReport(result) : renderHtmlReport(result);
    if (options.out) {
      await writeReportFile(options.out, content);
      console.log(`Report written to ${options.out}`);
      return;
    }
    console.log(content);
  });

const snapshot = program.command("snapshot").description("Offline snapshot commands");

snapshot
  .command("create")
  .description("Create an empty portable snapshot shell for offline workflows")
  .option("--out <path>", "Write snapshot JSON to a file")
  .action(async (options) => {
    const payload = createSnapshotPayload([], { source: "manual", note: "Populate through live CDP scanning workflow" });
    if (options.out) {
      await writeJsonFile(options.out, payload);
      console.log(`Snapshot written to ${options.out}`);
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
  });

program
  .command("playwright")
  .description("Playwright commands")
  .command("scan <path>")
  .description("Extract Playwright UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanPlaywrightFile(path)));
  });

program
  .command("selenium")
  .description("Selenium commands")
  .command("scan <path>")
  .description("Extract Selenium UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanSeleniumFile(path)));
  });

program
  .command("puppeteer")
  .description("Puppeteer commands")
  .command("scan <path>")
  .description("Extract Puppeteer UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanPuppeteerFile(path)));
  });

program.parse();

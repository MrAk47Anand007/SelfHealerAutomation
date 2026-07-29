#!/usr/bin/env node
import { Command } from "commander";
import { runA360LivePreflight } from "./commands/a360Live.js";
import { scanPlaywrightFile } from "./commands/playwright.js";
import { scanPuppeteerFile } from "./commands/puppeteer.js";
import { scanSeleniumFile } from "./commands/selenium.js";
import { createSnapshotPayload } from "./commands/snapshot.js";
import { healRerun, inspectRun, renderRunReport, writeRunArtifact } from "./commands/run.js";
import { writeJsonFile } from "./io/readWriteJson.js";
import { renderHtmlReport } from "./report/htmlReport.js";
import { renderJsonReport } from "./report/jsonReport.js";
import { writeReportFile } from "./report/writeReport.js";
import { loadLocalEnv } from "./env.js";

loadLocalEnv();

const program = new Command();

program.name("uiheal").description("Local-first UI automation preflight and healing CLI").version("0.1.0");

const a360 = program.command("a360").description("Automation Anywhere A360 commands");

program
  .command("analyze")
  .description("Create a universal UIHeal run artifact")
  .requiredOption("--tool <tool>", "Tool: a360, playwright, selenium, puppeteer, generic")
  .option("--file <path>", "Source artifact file")
  .option("--targets <path>", "Generic target catalog file")
  .option("--candidates <path>", "Candidate catalog or candidatesByTargetId JSON")
  .option("--cdp <port>", "CDP port metadata")
  .option("--policy <path>", "Policy JSON")
  .option("--out <path>", "Write UIHeal run JSON")
  .action(async (options) => {
    const artifact = await writeRunArtifact({ ...options, mode: "analyze" });
    if (options.out) {
      console.log(`Run written to ${options.out}`);
      return;
    }
    console.log(renderJsonReport(artifact));
  });

program
  .command("plan")
  .description("Render a UIHeal run artifact as a plan/report")
  .requiredOption("--run <path>", "UIHeal run JSON")
  .option("--report <format>", "html or json", "html")
  .option("--out <path>", "Write report")
  .action(async (options) => {
    const content = await renderRunReport(options);
    if (options.out) {
      await writeReportFile(options.out, content);
      console.log(`Report written to ${options.out}`);
      return;
    }
    console.log(content);
  });

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
  .option("--state-storage <path>", "Write/read Playwright storage state for stateful execution", "reports/uiheal-storage-state.json")
  .option("--state-headless", "Run Playwright state setup in headless mode", false)
  .option("--login-user-selector <selector>", "Login username/email selector")
  .option("--login-password-selector <selector>", "Login password selector")
  .option("--login-submit-selector <selector>", "Login submit selector")
  .option("--login-expected-url <pattern>", "Playwright URL pattern expected after login")
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

const run = program.command("run").description("Enterprise UIHeal run artifact commands");

run
  .command("create")
  .description("Create a universal UIHeal JSON run artifact")
  .requiredOption("--tool <tool>", "Tool: a360, playwright, selenium, puppeteer, generic")
  .option("--file <path>", "Source artifact file")
  .option("--targets <path>", "Generic target catalog file")
  .option("--candidates <path>", "Candidate catalog or candidatesByTargetId JSON")
  .option("--mode <mode>", "Mode: analyze, plan, heal, heal-rerun", "analyze")
  .option("--cdp <port>", "CDP port metadata")
  .option("--policy <path>", "Policy JSON")
  .option("--out <path>", "Write UIHeal run JSON")
  .action(async (options) => {
    const artifact = await writeRunArtifact(options);
    if (options.out) {
      console.log(`Run written to ${options.out}`);
      return;
    }
    console.log(renderJsonReport(artifact));
  });

run
  .command("report")
  .description("Render a UIHeal run artifact")
  .requiredOption("--run <path>", "UIHeal run JSON")
  .option("--report <format>", "html or json", "html")
  .option("--out <path>", "Write report")
  .action(async (options) => {
    const content = await renderRunReport(options);
    if (options.out) {
      await writeReportFile(options.out, content);
      console.log(`Report written to ${options.out}`);
      return;
    }
    console.log(content);
  });

run
  .command("inspect")
  .description("Print a compact UIHeal run summary")
  .requiredOption("--run <path>", "UIHeal run JSON")
  .action(async (options) => {
    console.log(renderJsonReport(await inspectRun(options)));
  });

program
  .command("heal-rerun")
  .description("Policy-gated patch preview plus rerun evidence for a UIHeal run")
  .requiredOption("--run <path>", "UIHeal run JSON")
  .option("--policy <path>", "Policy JSON")
  .option("--allow-origin <origin>", "Allowed origin override")
  .option("--backup-dir <path>", "Backup directory metadata", "backups")
  .option("--out <path>", "Write healed UIHeal run JSON")
  .action(async (options) => {
    const healed = await healRerun(options);
    if (options.out) {
      console.log(`Run written to ${options.out}`);
      return;
    }
    console.log(renderJsonReport(healed));
  });

const playwright = program.command("playwright").description("Playwright commands");

playwright
  .command("scan <path>")
  .description("Extract Playwright UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanPlaywrightFile(path)));
  });

playwright
  .command("preflight")
  .description("Create a UIHeal run artifact from a Playwright file")
  .requiredOption("--file <path>", "Playwright source file")
  .option("--mode <mode>", "Mode", "analyze")
  .option("--candidates <path>", "Candidate catalog or candidatesByTargetId JSON")
  .option("--out <path>", "Write UIHeal run JSON")
  .action(async (options) => {
    const run = await writeRunArtifact({ ...options, tool: "playwright" });
    if (options.out) console.log(`Run written to ${options.out}`);
    else console.log(renderJsonReport(run));
  });

const selenium = program.command("selenium").description("Selenium commands");

selenium
  .command("scan <path>")
  .description("Extract Selenium UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanSeleniumFile(path)));
  });

selenium
  .command("preflight")
  .description("Create a UIHeal run artifact from a Selenium file")
  .requiredOption("--file <path>", "Selenium source file")
  .option("--mode <mode>", "Mode", "analyze")
  .option("--candidates <path>", "Candidate catalog or candidatesByTargetId JSON")
  .option("--out <path>", "Write UIHeal run JSON")
  .action(async (options) => {
    const run = await writeRunArtifact({ ...options, tool: "selenium" });
    if (options.out) console.log(`Run written to ${options.out}`);
    else console.log(renderJsonReport(run));
  });

const puppeteer = program.command("puppeteer").description("Puppeteer commands");

puppeteer
  .command("scan <path>")
  .description("Extract Puppeteer UI targets from a file")
  .action(async (path) => {
    console.log(renderJsonReport(await scanPuppeteerFile(path)));
  });

puppeteer
  .command("preflight")
  .description("Create a UIHeal run artifact from a Puppeteer file")
  .requiredOption("--file <path>", "Puppeteer source file")
  .option("--mode <mode>", "Mode", "analyze")
  .option("--candidates <path>", "Candidate catalog or candidatesByTargetId JSON")
  .option("--out <path>", "Write UIHeal run JSON")
  .action(async (options) => {
    const run = await writeRunArtifact({ ...options, tool: "puppeteer" });
    if (options.out) console.log(`Run written to ${options.out}`);
    else console.log(renderJsonReport(run));
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

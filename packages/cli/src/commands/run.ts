import { copyFile, mkdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  createUIHealRun,
  evaluatePolicy,
  hashContent,
  uiHealRunSchema,
  type UIHealMode,
  type UIHealPolicy,
  type UIHealRun,
  type UIHealSourceArtifact
} from "@uiheal/artifacts";
import { createA360PatchPlan, extractA360Targets, type A360BotContent } from "@uiheal/adapters-a360";
import { createJsonPatchPlan, readJsonTargets } from "@uiheal/adapters-json";
import { createPlaywrightPatchPreview, extractPlaywrightTargets } from "@uiheal/adapters-playwright";
import { createSeleniumPatchPreview, extractSeleniumTargets } from "@uiheal/adapters-selenium";
import { createPuppeteerPatchPreview, extractPuppeteerTargets } from "@uiheal/adapters-puppeteer";
import type { PatchPlan, RepairSuggestion, SourceTool, UiCandidate, UiTarget } from "@uiheal/core";
import { readJsonFile, writeJsonFile } from "../io/readWriteJson.js";
import { renderEnterpriseHtmlReport } from "../report/htmlReport.js";
import { writeReportFile } from "../report/writeReport.js";

export interface RunCreateOptions {
  tool: SourceTool;
  file?: string;
  targets?: string;
  candidates?: string;
  mode?: UIHealMode;
  cdp?: string;
  out?: string;
  policy?: string;
}

export interface RunReportOptions {
  run: string;
  report?: "html" | "json";
  out?: string;
}

export interface RunInspectOptions {
  run: string;
}

export interface HealRerunOptions {
  run: string;
  policy?: string;
  allowOrigin?: string;
  backupDir?: string;
  out?: string;
}

async function readSource(input: RunCreateOptions): Promise<{ content: string; value: unknown; ref: string }> {
  const ref = input.file ?? input.targets;
  if (!ref) throw new Error("--file or --targets is required");
  const content = await readFile(ref, "utf8");
  return { content, value: JSON.parse(content), ref };
}

async function readCandidates(path: string | undefined, targets: UiTarget[]): Promise<Record<string, UiCandidate[]>> {
  if (!path) return {};
  const value = await readJsonFile<{ candidatesByTargetId?: Record<string, UiCandidate[]>; candidates?: UiCandidate[] } | UiCandidate[]>(path);
  if (Array.isArray(value)) return Object.fromEntries(targets.map((target) => [target.id, value]));
  if (value.candidatesByTargetId) return value.candidatesByTargetId;
  const candidates = value.candidates ?? [];
  return Object.fromEntries(targets.map((target) => [target.id, candidates]));
}

function patchPlansFor(input: {
  tool: SourceTool;
  sourceValue: unknown;
  sourceRef: string;
  targets: UiTarget[];
  repairs: RepairSuggestion[];
}): PatchPlan[] {
  return input.repairs.map((repair) => {
    if (input.tool === "a360") return createA360PatchPlan(input.sourceValue as A360BotContent, repair);
    if (input.tool === "playwright") return createPlaywrightPatchPreview(input.sourceRef, repair);
    if (input.tool === "selenium") return createSeleniumPatchPreview(input.sourceRef, repair);
    if (input.tool === "puppeteer") return createPuppeteerPatchPreview(input.sourceRef, repair);
    const target = input.targets.find((item) => item.id === repair.targetId);
    return target ? createJsonPatchPlan(target, repair.selector.value) : {
      artifactType: "generic",
      targetId: repair.targetId,
      operations: [],
      preview: `No generic target found for ${repair.targetId}`
    };
  });
}

async function loadPolicy(path?: string): Promise<Partial<UIHealPolicy>> {
  return path ? readJsonFile<Partial<UIHealPolicy>>(path) : {};
}

async function backupSource(run: UIHealRun, backupDir?: string) {
  if (run.source.kind !== "file" || !backupDir) return undefined;
  await mkdir(backupDir, { recursive: true });
  const path = join(backupDir, `${Date.now()}-${basename(run.source.ref)}`);
  await copyFile(run.source.ref, path);
  return { path, createdAt: new Date().toISOString(), sha256: run.source.sha256 };
}

function sourceArtifact(tool: SourceTool, ref: string, content: string): UIHealSourceArtifact {
  return {
    tool,
    kind: tool === "a360" ? "file" : "file",
    ref,
    sha256: hashContent(content)
  };
}

export async function createRunArtifact(options: RunCreateOptions): Promise<UIHealRun> {
  const mode = options.mode ?? "analyze";
  const policy = await loadPolicy(options.policy);
  let content = "";
  let sourceValue: unknown = {};
  let sourceRef = options.file ?? options.targets ?? "inline";
  let targets: UiTarget[] = [];

  if (options.tool === "generic") {
    const source = await readSource(options);
    content = source.content;
    sourceValue = source.value;
    sourceRef = source.ref;
    targets = readJsonTargets(source.value);
  } else {
    if (!options.file) throw new Error("--file is required for non-generic tools");
    content = await readFile(options.file, "utf8");
    sourceValue = options.tool === "a360" ? JSON.parse(content) : content;
    sourceRef = options.file;
    if (options.tool === "a360") targets = extractA360Targets(sourceValue as A360BotContent);
    if (options.tool === "playwright") targets = extractPlaywrightTargets(content, options.file);
    if (options.tool === "selenium") targets = extractSeleniumTargets(content, options.file);
    if (options.tool === "puppeteer") targets = extractPuppeteerTargets(content, options.file);
  }

  const runWithoutPatches = createUIHealRun({
    mode,
    source: sourceArtifact(options.tool, sourceRef, content),
    targets,
    candidatesByTargetId: await readCandidates(options.candidates, targets),
    policy,
    environment: { cdpPort: options.cdp ? Number(options.cdp) : undefined }
  });
  const patchPlans = patchPlansFor({
    tool: options.tool,
    sourceValue,
    sourceRef,
    targets,
    repairs: runWithoutPatches.outputs.repairSuggestions
  });
  return createUIHealRun({
    mode,
    source: sourceArtifact(options.tool, sourceRef, content),
    targets,
    candidatesByTargetId: runWithoutPatches.outputs.candidatesByTargetId,
    policy,
    environment: runWithoutPatches.environment,
    patchPlans
  });
}

export async function writeRunArtifact(options: RunCreateOptions): Promise<UIHealRun> {
  const run = await createRunArtifact(options);
  if (options.out) await writeJsonFile(options.out, run);
  return run;
}

export async function readRun(path: string): Promise<UIHealRun> {
  return uiHealRunSchema.parse(await readJsonFile<unknown>(path)) as unknown as UIHealRun;
}

export async function renderRunReport(options: RunReportOptions): Promise<string> {
  const run = await readRun(options.run);
  return options.report === "json" ? JSON.stringify(run, null, 2) : renderEnterpriseHtmlReport(run);
}

export async function inspectRun(options: RunInspectOptions): Promise<Record<string, unknown>> {
  const run = await readRun(options.run);
  return {
    runId: run.runId,
    mode: run.mode,
    tool: run.source.tool,
    source: run.source.ref,
    summary: run.outputs.summary,
    patchPlans: run.outputs.patchPlans.length,
    policyWarnings: evaluatePolicy({ run }).warnings
  };
}

export async function healRerun(options: HealRerunOptions): Promise<UIHealRun> {
  const run = await readRun(options.run);
  const policy = {
    ...(await loadPolicy(options.policy)),
    allowedOrigins: options.allowOrigin ? [options.allowOrigin] : undefined,
    allowApply: true
  };
  const decision = evaluatePolicy({ run, policy });
  const healed: UIHealRun = {
    ...run,
    mode: "heal-rerun",
    outputs: {
      ...run.outputs,
      patchResult: {
        mode: decision.allowed ? "preview" : "blocked",
        policyDecision: decision,
        backup: decision.allowed ? await backupSource(run, options.backupDir) : undefined,
        patchPlans: run.outputs.patchPlans,
        message: decision.allowed
          ? "Patch preview passed policy; artifact write-back is adapter-gated for a later apply pass."
          : "Patch blocked by policy."
      },
      rerunResult: {
        beforeSummary: run.outputs.summary,
        afterSummary: run.outputs.summary,
        improved: false,
        rolledBack: false
      }
    },
    audit: {
      ...run.audit,
      events: [
        ...run.audit.events,
        { at: new Date().toISOString(), level: decision.allowed ? "info" : "warn", message: decision.reason }
      ]
    }
  };
  if (options.out) await writeJsonFile(options.out, healed);
  return healed;
}

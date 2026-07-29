import {
  buildCandidateDiscoveryExpression,
  createCdpRuntime,
  evaluateInContext,
  findA360Page,
  findTargetPages,
  listCdpPages
} from "@uiheal/cdp";
import { buildGuidancePrompt, createOpenRouterClient, resolveOpenRouterOptions } from "@uiheal/ai";
import {
  buildA360FetchBotExpression,
  buildA360SessionProbeExpression,
  extractA360Targets,
  type A360BotContent,
  type A360SessionProbe
} from "@uiheal/adapters-a360";
import type { UiCandidate } from "@uiheal/core";
import {
  assertStatePlanExecutionAllowed,
  createDeterministicStatePlan,
  detectLoginRequirement,
  groupTargetsByState
} from "@uiheal/state-planner";
import { runA360Preflight, type A360PreflightResult } from "./a360.js";
import { writeReportFile } from "../report/writeReport.js";
import { executePlaywrightStateScan, type PlaywrightLoginSelectors } from "../stateful/playwrightState.js";

export interface A360LiveCliOptions {
  cdp: string;
  fileId?: string;
  report?: string;
  out?: string;
  apply?: boolean;
  ai?: "off" | "guide" | "plan";
  aiProvider?: "openrouter";
  aiModel?: string;
  aiMaxTargets?: string;
  stateful?: "manual" | "assist" | "execute";
  allowOrigin?: string;
  executeStatePlan?: boolean;
  statePlanOut?: string;
  stateStorage?: string;
  stateHeadless?: boolean;
  loginUserSelector?: string;
  loginPasswordSelector?: string;
  loginSubmitSelector?: string;
  loginExpectedUrl?: string;
}

export interface A360LivePlan {
  cdpPort: number;
  fileId?: string;
  reportFormat: "json" | "html";
  outPath?: string;
  apply: boolean;
  ai: {
    mode: "off" | "guide" | "plan";
    provider: "openrouter";
    model: string;
    maxTargets: number;
  };
  stateful: {
    mode: "manual" | "assist" | "execute";
    allowOrigin?: string;
    execute: boolean;
    statePlanOut?: string;
    storageStatePath: string;
    headless: boolean;
    selectors: PlaywrightLoginSelectors;
  };
}

export function planA360LivePreflight(options: A360LiveCliOptions): A360LivePlan {
  return {
    cdpPort: Number(options.cdp),
    fileId: options.fileId,
    reportFormat: options.report === "json" ? "json" : "html",
    outPath: options.out,
    apply: options.apply === true,
    ai: {
      mode: options.ai || "off",
      provider: options.aiProvider || "openrouter",
      model: options.aiModel || process.env.UIHEAL_AI_MODEL || "openrouter/auto",
      maxTargets: Number(options.aiMaxTargets || 5)
    },
    stateful: {
      mode: options.stateful || "manual",
      allowOrigin: options.allowOrigin,
      execute: options.executeStatePlan === true,
      statePlanOut: options.statePlanOut,
      storageStatePath: options.stateStorage || "reports/uiheal-storage-state.json",
      headless: options.stateHeadless === true,
      selectors: {
        username: options.loginUserSelector || "input[name='email'], input[type='email'], input[name='username']",
        password: options.loginPasswordSelector || "input[type='password']",
        submit: options.loginSubmitSelector || "button[type='submit'], input[type='submit']",
        expectedUrlPattern: options.loginExpectedUrl
      }
    }
  };
}

export function buildAiWarningForMissingKey(ai: { mode: string }): string | undefined {
  return ai.mode === "off" || process.env.OPENROUTER_API_KEY
    ? undefined
    : "OPENROUTER_API_KEY is missing; deterministic preflight completed without AI guidance.";
}

export async function runA360LivePreflight(options: A360LiveCliOptions): Promise<A360PreflightResult> {
  const plan = planA360LivePreflight(options);
  if (!Number.isFinite(plan.cdpPort)) throw new Error("--cdp must be a valid port number");

  const pages = await listCdpPages(plan.cdpPort);
  const a360Page = findA360Page(pages, plan.fileId);
  if (!a360Page) throw new Error("A360 bot editor page was not found in Chrome CDP pages");

  const a360Runtime = await createCdpRuntime(a360Page.webSocketDebuggerUrl);
  try {
    const probe = await evaluateInContext<A360SessionProbe>(a360Runtime, {
      expression: buildA360SessionProbeExpression(plan.fileId)
    });
    if (!probe.hasAuthToken || !probe.fileId) throw new Error("A360 session is missing auth token or file id");

    const bot = await evaluateInContext<A360BotContent>(a360Runtime, {
      expression: buildA360FetchBotExpression(probe.fileId)
    });

    const targets = extractA360Targets(bot);
    const stateGroups = groupTargetsByState(targets);
    const loginRequirement = detectLoginRequirement(
      stateGroups,
      pages.filter((page) => page.type === "page").map((page) => page.url)
    );
    const deterministicStatePlan = createDeterministicStatePlan({
      mode: plan.stateful.mode,
      loginRequirement
    });
    if (plan.stateful.mode === "execute") {
      assertStatePlanExecutionAllowed({ execute: plan.stateful.execute, allowOrigin: plan.stateful.allowOrigin });
    }
    if (deterministicStatePlan.script && plan.stateful.statePlanOut) {
      await writeReportFile(plan.stateful.statePlanOut, deterministicStatePlan.script);
    }

    const targetUrls = [...new Set(targets.map((target) => target.url).filter((url): url is string => Boolean(url)))];
    const targetPages = findTargetPages(pages, targetUrls);
    const candidatesByTargetId: Record<string, UiCandidate[]> = {};

    for (const target of targets) {
      const page = targetPages.find((item) => target.url && item.url.startsWith(target.url));
      if (!page) {
        candidatesByTargetId[target.id] = [];
        continue;
      }
      const runtime = await createCdpRuntime(page.webSocketDebuggerUrl);
      try {
        candidatesByTargetId[target.id] = await evaluateInContext<UiCandidate[]>(runtime, {
          expression: buildCandidateDiscoveryExpression(target)
        });
      } finally {
        runtime.close();
      }
    }

    let stateExecution: { storageStatePath: string; scannedUrls: string[]; candidateTargetIds: string[] } | undefined;
    if (plan.stateful.mode === "execute" && loginRequirement.required) {
      const loginUrl = loginRequirement.loginState?.url;
      if (!loginUrl) throw new Error("Stateful execution requires a detected login URL");
      const executedState = await executePlaywrightStateScan({
        loginUrl,
        allowOrigin: plan.stateful.allowOrigin ?? "",
        storageStatePath: plan.stateful.storageStatePath,
        headless: plan.stateful.headless,
        selectors: plan.stateful.selectors,
        missingGroups: loginRequirement.missingStates
      });
      for (const [targetId, candidates] of Object.entries(executedState.candidatesByTargetId)) {
        candidatesByTargetId[targetId] = candidates;
      }
      stateExecution = {
        storageStatePath: executedState.storageStatePath,
        scannedUrls: executedState.scannedUrls,
        candidateTargetIds: Object.keys(executedState.candidatesByTargetId)
      };
    }

    const result = await runA360Preflight({ bot, candidatesByTargetId });
    result.statePlan = {
      groups: stateGroups.map((group) => ({ stateId: group.stateId, origin: group.origin, url: group.url, targetCount: group.targets.length })),
      loginRequirement,
      deterministicStatePlan: {
        ...deterministicStatePlan,
        script: deterministicStatePlan.script ? "[written to state plan artifact]" : undefined
      },
      execution: stateExecution
    };

    const aiWarning = buildAiWarningForMissingKey(plan.ai);
    if (aiWarning) {
      result.aiWarning = aiWarning;
      return result;
    }

    if (plan.ai.mode !== "off") {
      try {
        const resolved = resolveOpenRouterOptions({ model: plan.ai.model });
        const client = createOpenRouterClient({ model: resolved.model, apiKey: resolved.apiKey });
        const targetsById = new Map(targets.map((target) => [target.id, target]));
        const patchByTargetId = new Map(result.patchPlans.map((patch) => [patch.targetId, patch]));
        const guidanceTargets = result.results
          .filter((item) => item.status !== "pass")
          .slice(0, plan.ai.maxTargets);
        result.aiGuidance = [];
        for (const validation of guidanceTargets) {
          const target = targetsById.get(validation.targetId);
          if (!target) continue;
          const rawText = await client.complete(
            buildGuidancePrompt({
              target,
              validation,
              candidates: candidatesByTargetId[target.id] ?? [],
              patchPlan: patchByTargetId.get(target.id)
            })
          );
          result.aiGuidance.push({
            provider: "openrouter",
            model: resolved.model,
            targetId: target.id,
            rawText
          });
        }
      } catch (error) {
        result.aiWarning = `AI guidance failed; deterministic preflight completed. ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    return result;
  } finally {
    a360Runtime.close();
  }
}

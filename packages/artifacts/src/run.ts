import { createHash, randomUUID } from "node:crypto";
import { createPreflightSummary, suggestRepair, validateTarget, type UiCandidate, type UiTarget } from "@uiheal/core";
import type { UIHealMode, UIHealPolicy, UIHealRun, UIHealSourceArtifact } from "./types.js";
import { redactSecrets } from "./redaction.js";

export const DEFAULT_ENTERPRISE_POLICY: UIHealPolicy = {
  allowedTools: ["a360", "playwright", "selenium", "puppeteer", "generic"],
  allowedOrigins: [],
  minAutoHealConfidence: 0.85,
  allowDestructiveActions: false,
  allowApply: false,
  redactSecrets: true
};

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function createUIHealRun(input: {
  mode: UIHealMode;
  source: UIHealSourceArtifact;
  targets: UiTarget[];
  candidatesByTargetId?: Record<string, UiCandidate[]>;
  policy?: Partial<UIHealPolicy>;
  environment?: Partial<UIHealRun["environment"]>;
  patchPlans?: UIHealRun["outputs"]["patchPlans"];
}): UIHealRun {
  const candidatesByTargetId = input.candidatesByTargetId ?? {};
  const results = input.targets.map((target) => validateTarget(target, candidatesByTargetId[target.id] ?? []));
  const repairSuggestions = input.targets.flatMap((target) => {
    const suggestion = suggestRepair(target, candidatesByTargetId[target.id] ?? []);
    return suggestion ? [suggestion] : [];
  });
  const run: UIHealRun = {
    schemaVersion: 1,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    mode: input.mode,
    source: input.source,
    environment: {
      runtime: "local-cli",
      rdpSafe: true,
      ...input.environment
    },
    policy: {
      ...DEFAULT_ENTERPRISE_POLICY,
      ...input.policy
    },
    inputs: { targets: input.targets },
    outputs: {
      candidatesByTargetId,
      results,
      repairSuggestions,
      patchPlans: input.patchPlans ?? [],
      summary: createPreflightSummary(results)
    },
    audit: {
      redacted: input.policy?.redactSecrets ?? DEFAULT_ENTERPRISE_POLICY.redactSecrets,
      events: [{ at: new Date().toISOString(), level: "info", message: "UIHeal run artifact created" }]
    }
  };
  return run.policy.redactSecrets ? redactSecrets(run) : run;
}

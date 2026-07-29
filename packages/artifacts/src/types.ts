import type {
  PatchPlan,
  PreflightSummary,
  RepairSuggestion,
  SourceTool,
  UiCandidate,
  UiTarget,
  ValidationResult
} from "@uiheal/core";

export type UIHealMode = "analyze" | "plan" | "heal" | "heal-rerun" | "execute-workflow";

export interface UIHealSourceArtifact {
  tool: SourceTool;
  kind: "file" | "a360-control-room" | "inline" | "snapshot";
  ref: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export interface UIHealEnvironment {
  runtime: "local-cli";
  rdpSafe: boolean;
  cdpPort?: number;
  origins?: string[];
  metadata?: Record<string, unknown>;
}

export interface UIHealPolicy {
  allowedTools: SourceTool[];
  allowedOrigins: string[];
  minAutoHealConfidence: number;
  allowDestructiveActions: boolean;
  allowApply: boolean;
  redactSecrets: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  violations: string[];
  warnings: string[];
}

export interface StatePlanArtifact {
  mode: "manual" | "assist" | "execute";
  required: boolean;
  warning?: string;
  execution?: Record<string, unknown>;
}

export interface BackupRef {
  path: string;
  createdAt: string;
  sha256?: string;
}

export interface PatchResult {
  mode: "preview" | "applied" | "rolled-back" | "blocked";
  policyDecision: PolicyDecision;
  backup?: BackupRef;
  patchPlans: PatchPlan[];
  changedArtifactRef?: string;
  message: string;
}

export interface RerunResult {
  beforeSummary: PreflightSummary;
  afterSummary: PreflightSummary;
  improved: boolean;
  rolledBack: boolean;
}

export interface AiGuidanceArtifact {
  provider: "openrouter";
  model: string;
  targetId: string;
  rawText: string;
}

export interface UIHealRun {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  mode: UIHealMode;
  source: UIHealSourceArtifact;
  environment: UIHealEnvironment;
  policy: UIHealPolicy;
  inputs: {
    targets: UiTarget[];
  };
  outputs: {
    candidatesByTargetId: Record<string, UiCandidate[]>;
    results: ValidationResult[];
    repairSuggestions: RepairSuggestion[];
    patchPlans: PatchPlan[];
    summary: PreflightSummary;
    aiGuidance?: AiGuidanceArtifact[];
    aiWarning?: string;
    statePlan?: StatePlanArtifact;
    patchResult?: PatchResult;
    rerunResult?: RerunResult;
  };
  audit: {
    redacted: boolean;
    events: Array<{ at: string; level: "info" | "warn" | "error"; message: string }>;
  };
}

export interface PatchedArtifact {
  content: unknown;
  ref?: string;
}

export interface AutomationAdapter<TSource = unknown> {
  tool: SourceTool;
  extractTargets(source: TSource): UiTarget[];
  createPatchPlan(source: TSource, repair: RepairSuggestion): PatchPlan;
  applyPatch?(source: TSource, patchPlan: PatchPlan): PatchedArtifact;
  backup?(source: TSource, backupDir: string): Promise<BackupRef> | BackupRef;
}

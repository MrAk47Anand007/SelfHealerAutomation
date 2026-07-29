export type SourceTool = "a360" | "playwright" | "selenium" | "puppeteer" | "generic";

export type SelectorKind = "css" | "xpath" | "id" | "name" | "text" | "role" | "a360-path";

export interface UiSelector {
  kind: SelectorKind;
  value: string;
  enabled: boolean;
  source?: string;
  weight?: number;
}

export interface UiFrameRef {
  url?: string;
  name?: string;
  path?: string;
}

export interface UiElementIdentity {
  tag?: string;
  type?: string;
  role?: string;
  id?: string;
  name?: string;
  text?: string;
  label?: string;
  classes?: string[];
  attributes?: Record<string, string>;
}

export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiContext {
  version: number;
  target?: Record<string, unknown>;
  precedingSiblings?: unknown[];
  followingSiblings?: unknown[];
  spatialNeighbors?: unknown;
  container?: unknown;
  position?: unknown;
  ancestorChain?: unknown[];
  [key: string]: unknown;
}

export interface UiTarget {
  id: string;
  sourceTool: SourceTool;
  action?: string;
  selectors: UiSelector[];
  url?: string;
  frame?: UiFrameRef;
  element: UiElementIdentity;
  rect?: UiRect;
  surroundingContext?: UiContext;
  metadata?: Record<string, unknown>;
}

export interface UiCandidate {
  candidateId: string;
  selector?: UiSelector;
  url?: string;
  frame?: UiFrameRef;
  element: UiElementIdentity;
  rect?: UiRect;
  surroundingContext?: UiContext;
  metadata?: Record<string, unknown>;
}

export interface ValidationSignal {
  name: string;
  score: number;
  weight: number;
  message: string;
}

export interface ValidationResult {
  targetId: string;
  status: "pass" | "repairable" | "failed";
  confidence: number;
  matchedCandidate?: UiCandidate;
  signals: ValidationSignal[];
  reason: string;
}

export interface RepairSuggestion {
  targetId: string;
  selector: UiSelector;
  confidence: number;
  reason: string;
  candidate: UiCandidate;
}

export interface PatchOperation {
  path: string;
  op: "replace" | "add";
  value: unknown;
}

export interface PatchPlan {
  artifactType: SourceTool;
  targetId: string;
  operations: PatchOperation[];
  preview: string;
}

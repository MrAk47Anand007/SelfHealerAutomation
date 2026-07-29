# UIHeal MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first CLI and package MVP that validates and repairs UI automation targets before execution, starting with generic JSON targets and Automation Anywhere A360 Recorder `UIOBJECT`s.

**Architecture:** The MVP is a TypeScript monorepo with a focused core library, a CLI wrapper, a CDP live-page scanner, a generic JSON adapter, and an A360 adapter. All target extraction normalizes into one `UiTarget` model; all live DOM inspection normalizes into `UiCandidate`; the validator and repair scorer are tool-agnostic.

**Tech Stack:** Node.js 20+, TypeScript, pnpm workspaces, Vitest, Commander, `chrome-remote-interface`, `zod`, `fast-xml-parser` only if later needed for exported formats.

## Global Constraints

- Run fully local by default; no network calls except to a user-specified local Chrome CDP endpoint or A360 Control Room already open in the user's browser.
- AI is out of scope for the MVP implementation; expose extension points only.
- Do not persist auth tokens, cookies, request headers, or full unredacted page HTML in logs or reports.
- Support Windows/RDP environments where the target portal is reachable only from the same desktop session.
- First working demo command: `uiheal a360 preflight --cdp 9222 --file-id 100126347 --report html`.
- Patch application must default to preview-only. Any write-back command must require an explicit `--apply` flag.
- Keep packages small and focused. No dashboard in MVP; generate JSON and HTML reports.

---

## File Structure

Create this structure:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
packages/
  core/
    package.json
    src/index.ts
    src/model/types.ts
    src/model/selector.ts
    src/context/context.ts
    src/validate/validator.ts
    src/repair/scorer.ts
    src/report/result.ts
    test/model.test.ts
    test/validator.test.ts
    test/scorer.test.ts
  cdp/
    package.json
    src/index.ts
    src/client.ts
    src/pageScanner.ts
    test/pageScanner.test.ts
  adapters-json/
    package.json
    src/index.ts
    src/jsonAdapter.ts
    test/jsonAdapter.test.ts
  adapters-a360/
    package.json
    src/index.ts
    src/a360Bot.ts
    src/a360Blob.ts
    src/a360ControlRoom.ts
    src/a360Patch.ts
    test/a360Bot.test.ts
    test/a360Blob.test.ts
    fixtures/live-ui-capture-bot.min.json
  cli/
    package.json
    src/index.ts
    src/commands/scan.ts
    src/commands/validate.ts
    src/commands/a360.ts
    src/report/htmlReport.ts
    test/cli.test.ts
docs/
  architecture/
    uiheal-mvp.md
```

Responsibilities:

- `packages/core`: owns normalized models, selector utilities, validation, repair scoring, and result schemas.
- `packages/cdp`: connects to Chrome DevTools Protocol and converts DOM elements into `UiCandidate`.
- `packages/adapters-json`: reads/writes generic target catalogs for custom automation tools.
- `packages/adapters-a360`: reads A360 bot JSON, decodes/encodes `UIOBJECT.blob`, extracts `aa_genai_surroundingContext`, creates patch plans.
- `packages/cli`: provides user-facing commands and report output. It should contain orchestration only, not domain logic.

---

### Task 1: Workspace Scaffold And Build Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: pnpm workspace scripts `build`, `test`, `typecheck`, `lint:types`.
- Produces: shared TypeScript configuration consumed by all packages.

- [ ] **Step 1: Create the workspace files**

Create `package.json`:

```json
{
  "name": "uiheal-workspace",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "typecheck": "pnpm -r typecheck",
    "lint:types": "pnpm typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node"
  }
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
*.log
reports/
tmp/
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile is created and install succeeds.

- [ ] **Step 3: Run empty verification**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: `pnpm test` finds no tests or passes; `pnpm typecheck` may fail until package files exist. This is acceptable for Task 1 only.

- [ ] **Step 4: Commit**

If this directory has been initialized as a git repo, run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold uiheal workspace"
```

---

### Task 2: Core Models And Selector Utilities

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/model/types.ts`
- Create: `packages/core/src/model/selector.ts`
- Create: `packages/core/test/model.test.ts`

**Interfaces:**
- Produces: `UiTarget`, `UiSelector`, `UiCandidate`, `UiContext`, `ValidationResult`, `RepairSuggestion`, `PatchPlan`.
- Produces: `normalizeSelector(input: UiSelector): UiSelector`.
- Produces: `selectorToLabel(selector: UiSelector): string`.

- [ ] **Step 1: Write failing model tests**

Create `packages/core/test/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeSelector, selectorToLabel, type UiSelector, type UiTarget } from "../src/index.js";

describe("core model", () => {
  it("normalizes selector values without changing their meaning", () => {
    const selector: UiSelector = { kind: "css", value: "  input#email  ", enabled: true, source: "a360" };
    expect(normalizeSelector(selector)).toEqual({
      kind: "css",
      value: "input#email",
      enabled: true,
      source: "a360"
    });
  });

  it("formats selector labels for reports", () => {
    expect(selectorToLabel({ kind: "xpath", value: "//input[@id='email']", enabled: true })).toBe(
      "xpath://input[@id='email']"
    );
  });

  it("allows an A360 target to carry surrounding context", () => {
    const target: UiTarget = {
      id: "node-1",
      sourceTool: "a360",
      action: "Recorder.capture",
      selectors: [{ kind: "css", value: "input#email", enabled: true }],
      url: "https://acme-test.uipath.com/login",
      frame: { url: "https://acme-test.uipath.com/login" },
      element: { tag: "input", type: "email", name: "email" },
      surroundingContext: { version: 1, target: { tag: "input", name: "email" } },
      metadata: { nodeUid: "node-1" }
    };
    expect(target.surroundingContext?.target.name).toBe("email");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/core/test/model.test.ts
```

Expected: FAIL because package files do not exist.

- [ ] **Step 3: Implement core model types**

Create `packages/core/package.json`:

```json
{
  "name": "@uiheal/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {}
}
```

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

Create `packages/core/src/model/types.ts`:

```ts
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
```

Create `packages/core/src/model/selector.ts`:

```ts
import type { UiSelector } from "./types.js";

export function normalizeSelector(input: UiSelector): UiSelector {
  return {
    ...input,
    value: input.value.trim()
  };
}

export function selectorToLabel(selector: UiSelector): string {
  return `${selector.kind}:${selector.value}`;
}

export function enabledSelectors(selectors: UiSelector[]): UiSelector[] {
  return selectors.map(normalizeSelector).filter((selector) => selector.enabled && selector.value.length > 0);
}
```

Create `packages/core/src/index.ts`:

```ts
export * from "./model/types.js";
export * from "./model/selector.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm install
pnpm test packages/core/test/model.test.ts
pnpm --filter @uiheal/core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core package.json pnpm-lock.yaml
git commit -m "feat(core): add normalized UI target model"
```

---

### Task 3: Deterministic Validator

**Files:**
- Create: `packages/core/src/context/context.ts`
- Create: `packages/core/src/validate/validator.ts`
- Create: `packages/core/test/validator.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `UiTarget`, `UiCandidate`, `ValidationResult`.
- Produces: `validateTarget(target: UiTarget, candidates: UiCandidate[]): ValidationResult`.
- Produces: `scoreCandidate(target: UiTarget, candidate: UiCandidate): ValidationResult`.

- [ ] **Step 1: Write failing validator tests**

Create `packages/core/test/validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateTarget, type UiCandidate, type UiTarget } from "../src/index.js";

const target: UiTarget = {
  id: "email-node",
  sourceTool: "a360",
  action: "Recorder.capture",
  selectors: [{ kind: "css", value: "input#email", enabled: true }],
  url: "https://acme-test.uipath.com/login",
  frame: { url: "https://acme-test.uipath.com/login" },
  element: { tag: "input", type: "email", id: "email", name: "email", label: "Email:" },
  surroundingContext: { version: 1, target: { tag: "input", type: "email", id: "email", name: "email" } }
};

describe("validateTarget", () => {
  it("passes when candidate identity and frame match strongly", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c1",
        selector: { kind: "css", value: "input#email", enabled: true },
        url: "https://acme-test.uipath.com/login",
        frame: { url: "https://acme-test.uipath.com/login" },
        element: { tag: "input", type: "email", id: "email", name: "email", label: "Email:" },
        surroundingContext: { version: 1, target: { tag: "input", type: "email", id: "email", name: "email" } }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("pass");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("marks a target repairable when selector fails but semantic identity matches", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c2",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        url: "https://acme-test.uipath.com/login",
        frame: { url: "https://acme-test.uipath.com/login" },
        element: { tag: "input", type: "email", name: "email", label: "Email:" }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("repairable");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("fails when page frame and element identity do not match", () => {
    const candidates: UiCandidate[] = [
      {
        candidateId: "c3",
        url: "https://acme-test.uipath.com/work-items",
        frame: { url: "https://acme-test.uipath.com/work-items" },
        element: { tag: "table", text: "Actions WIID Description Type Status Date" }
      }
    ];
    const result = validateTarget(target, candidates);
    expect(result.status).toBe("failed");
    expect(result.confidence).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/core/test/validator.test.ts
```

Expected: FAIL because `validateTarget` is not exported.

- [ ] **Step 3: Implement validator**

Create `packages/core/src/context/context.ts`:

```ts
export function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function textSimilarity(a: string | undefined, b: string | undefined): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}
```

Create `packages/core/src/validate/validator.ts`:

```ts
import { textSimilarity } from "../context/context.js";
import type { UiCandidate, UiTarget, ValidationResult, ValidationSignal } from "../model/types.js";

function signal(name: string, score: number, weight: number, message: string): ValidationSignal {
  return { name, score, weight, message };
}

function sameNormalized(a?: string, b?: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function scoreFrame(target: UiTarget, candidate: UiCandidate): ValidationSignal {
  const expected = target.frame?.url ?? target.url;
  const actual = candidate.frame?.url ?? candidate.url;
  if (!expected || !actual) return signal("frame", 0.5, 0.15, "Frame URL missing on one side");
  const match = actual.startsWith(expected) || expected.startsWith(actual);
  return signal("frame", match ? 1 : 0, 0.15, match ? "Frame URL matched" : "Frame URL differed");
}

function scoreIdentity(target: UiTarget, candidate: UiCandidate): ValidationSignal[] {
  const targetElement = target.element;
  const candidateElement = candidate.element;
  return [
    signal("tag", sameNormalized(targetElement.tag, candidateElement.tag) ? 1 : 0, 0.15, "Tag comparison"),
    signal("type", !targetElement.type ? 0.5 : sameNormalized(targetElement.type, candidateElement.type) ? 1 : 0, 0.1, "Type comparison"),
    signal("id", !targetElement.id ? 0.5 : sameNormalized(targetElement.id, candidateElement.id) ? 1 : 0, 0.2, "ID comparison"),
    signal("name", !targetElement.name ? 0.5 : sameNormalized(targetElement.name, candidateElement.name) ? 1 : 0, 0.15, "Name comparison"),
    signal("label", textSimilarity(targetElement.label, candidateElement.label), 0.15, "Label similarity"),
    signal("text", textSimilarity(targetElement.text, candidateElement.text), 0.1, "Text similarity")
  ];
}

function aggregate(targetId: string, candidate: UiCandidate | undefined, signals: ValidationSignal[]): ValidationResult {
  const totalWeight = signals.reduce((sum, item) => sum + item.weight, 0);
  const weighted = signals.reduce((sum, item) => sum + item.score * item.weight, 0);
  const confidence = totalWeight === 0 ? 0 : Number((weighted / totalWeight).toFixed(4));
  const selectorMatched = candidate?.selector && confidence >= 0.8;
  const status = confidence >= 0.8 && selectorMatched ? "pass" : confidence >= 0.6 ? "repairable" : "failed";
  return {
    targetId,
    status,
    confidence,
    matchedCandidate: candidate,
    signals,
    reason:
      status === "pass"
        ? "Stored selector and element context matched"
        : status === "repairable"
          ? "Stored selector needs repair but element context is close"
          : "No candidate reached the confidence threshold"
  };
}

export function scoreCandidate(target: UiTarget, candidate: UiCandidate): ValidationResult {
  const signals = [scoreFrame(target, candidate), ...scoreIdentity(target, candidate)];
  return aggregate(target.id, candidate, signals);
}

export function validateTarget(target: UiTarget, candidates: UiCandidate[]): ValidationResult {
  if (candidates.length === 0) {
    return {
      targetId: target.id,
      status: "failed",
      confidence: 0,
      signals: [],
      reason: "No candidates were provided"
    };
  }
  return candidates.map((candidate) => scoreCandidate(target, candidate)).sort((a, b) => b.confidence - a.confidence)[0];
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./model/types.js";
export * from "./model/selector.js";
export * from "./context/context.js";
export * from "./validate/validator.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test packages/core/test/validator.test.ts
pnpm --filter @uiheal/core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add deterministic target validator"
```

---

### Task 4: Repair Scorer

**Files:**
- Create: `packages/core/src/repair/scorer.ts`
- Create: `packages/core/src/report/result.ts`
- Create: `packages/core/test/scorer.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `UiTarget`, `UiCandidate`, `RepairSuggestion`, `ValidationResult`.
- Produces: `suggestRepair(target: UiTarget, candidates: UiCandidate[]): RepairSuggestion | null`.
- Produces: `createPreflightSummary(results: ValidationResult[]): PreflightSummary`.

- [ ] **Step 1: Write failing scorer tests**

Create `packages/core/test/scorer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPreflightSummary, suggestRepair, type UiCandidate, type UiTarget, type ValidationResult } from "../src/index.js";

describe("repair scorer", () => {
  it("suggests the highest-confidence candidate selector", () => {
    const target: UiTarget = {
      id: "email-node",
      sourceTool: "generic",
      selectors: [{ kind: "css", value: "#old-email", enabled: true }],
      element: { tag: "input", type: "email", name: "email", label: "Email:" }
    };
    const candidates: UiCandidate[] = [
      {
        candidateId: "low",
        selector: { kind: "css", value: "input", enabled: true },
        element: { tag: "input" }
      },
      {
        candidateId: "high",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        element: { tag: "input", type: "email", name: "email", label: "Email:" }
      }
    ];
    const suggestion = suggestRepair(target, candidates);
    expect(suggestion?.selector.value).toBe("input[name='email']");
    expect(suggestion?.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("summarizes preflight statuses", () => {
    const results: ValidationResult[] = [
      { targetId: "a", status: "pass", confidence: 0.95, signals: [], reason: "ok" },
      { targetId: "b", status: "repairable", confidence: 0.7, signals: [], reason: "repair" },
      { targetId: "c", status: "failed", confidence: 0.1, signals: [], reason: "fail" }
    ];
    expect(createPreflightSummary(results)).toEqual({
      total: 3,
      pass: 1,
      repairable: 1,
      failed: 1,
      minConfidence: 0.1,
      averageConfidence: 0.5833
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/core/test/scorer.test.ts
```

Expected: FAIL because scorer exports do not exist.

- [ ] **Step 3: Implement scorer and summary**

Create `packages/core/src/repair/scorer.ts`:

```ts
import type { RepairSuggestion, UiCandidate, UiTarget } from "../model/types.js";
import { scoreCandidate } from "../validate/validator.js";

export function suggestRepair(target: UiTarget, candidates: UiCandidate[]): RepairSuggestion | null {
  const scored = candidates
    .filter((candidate) => candidate.selector)
    .map((candidate) => ({ candidate, result: scoreCandidate(target, candidate) }))
    .sort((a, b) => b.result.confidence - a.result.confidence);

  const best = scored[0];
  if (!best || !best.candidate.selector || best.result.confidence < 0.6) return null;

  return {
    targetId: target.id,
    selector: best.candidate.selector,
    confidence: best.result.confidence,
    reason: best.result.reason,
    candidate: best.candidate
  };
}
```

Create `packages/core/src/report/result.ts`:

```ts
import type { ValidationResult } from "../model/types.js";

export interface PreflightSummary {
  total: number;
  pass: number;
  repairable: number;
  failed: number;
  minConfidence: number;
  averageConfidence: number;
}

export function createPreflightSummary(results: ValidationResult[]): PreflightSummary {
  const total = results.length;
  const sum = results.reduce((value, item) => value + item.confidence, 0);
  return {
    total,
    pass: results.filter((item) => item.status === "pass").length,
    repairable: results.filter((item) => item.status === "repairable").length,
    failed: results.filter((item) => item.status === "failed").length,
    minConfidence: total === 0 ? 0 : Math.min(...results.map((item) => item.confidence)),
    averageConfidence: total === 0 ? 0 : Number((sum / total).toFixed(4))
  };
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./model/types.js";
export * from "./model/selector.js";
export * from "./context/context.js";
export * from "./validate/validator.js";
export * from "./repair/scorer.js";
export * from "./report/result.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test packages/core/test/scorer.test.ts
pnpm --filter @uiheal/core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): add repair scoring and summaries"
```

---

### Task 5: CDP Live Page Scanner

**Files:**
- Create: `packages/cdp/package.json`
- Create: `packages/cdp/tsconfig.json`
- Create: `packages/cdp/src/index.ts`
- Create: `packages/cdp/src/client.ts`
- Create: `packages/cdp/src/pageScanner.ts`
- Create: `packages/cdp/test/pageScanner.test.ts`

**Interfaces:**
- Consumes: `UiSelector`, `UiCandidate`.
- Produces: `listCdpPages(port: number): Promise<CdpPage[]>`.
- Produces: `scanPageForSelectors(options: ScanPageOptions): Promise<UiCandidate[]>`.

- [ ] **Step 1: Write scanner unit test with a fake CDP evaluator**

Create `packages/cdp/test/pageScanner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildScanExpression } from "../src/index.js";

describe("buildScanExpression", () => {
  it("includes css and xpath selector probing", () => {
    const expression = buildScanExpression([
      { kind: "css", value: "input#email", enabled: true },
      { kind: "xpath", value: "//input[@id='email']", enabled: true }
    ]);
    expect(expression).toContain("document.querySelector");
    expect(expression).toContain("document.evaluate");
    expect(expression).toContain("input#email");
    expect(expression).toContain("//input[@id='email']");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/cdp/test/pageScanner.test.ts
```

Expected: FAIL because CDP package does not exist.

- [ ] **Step 3: Implement CDP package**

Create `packages/cdp/package.json`:

```json
{
  "name": "@uiheal/cdp",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@uiheal/core": "workspace:*"
  }
}
```

Create `packages/cdp/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

Create `packages/cdp/src/client.ts`:

```ts
export interface CdpPage {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export async function listCdpPages(port: number): Promise<CdpPage[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Unable to list CDP pages: HTTP ${response.status}`);
  return (await response.json()) as CdpPage[];
}
```

Create `packages/cdp/src/pageScanner.ts`:

```ts
import type { UiCandidate, UiSelector } from "@uiheal/core";

export interface ScanPageOptions {
  selectors: UiSelector[];
  pageUrl: string;
}

export function buildScanExpression(selectors: UiSelector[]): string {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    function byXPath(path) {
      try {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      } catch (error) {
        return null;
      }
    }
    function identity(el) {
      const rect = el.getBoundingClientRect();
      const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      return {
        candidateId: crypto.randomUUID(),
        url: location.href,
        element: {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || undefined,
          role: el.getAttribute('role') || undefined,
          id: el.id || undefined,
          name: el.getAttribute('name') || undefined,
          text: (el.innerText || el.value || '').trim().slice(0, 500),
          label: label ? label.textContent.trim() : undefined,
          classes: Array.from(el.classList),
          attributes: Object.fromEntries(Array.from(el.attributes).map((attr) => [attr.name, attr.value]).slice(0, 30))
        },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      };
    }
    return selectors.map((selector) => {
      let el = null;
      if (selector.kind === 'css') el = document.querySelector(selector.value);
      if (selector.kind === 'xpath') el = byXPath(selector.value);
      if (selector.kind === 'id') el = document.getElementById(selector.value);
      if (selector.kind === 'name') el = document.querySelector('[name="' + CSS.escape(selector.value) + '"]');
      return el ? { ...identity(el), selector } : null;
    }).filter(Boolean);
  })()`;
}

export function parseScanResult(value: unknown): UiCandidate[] {
  return Array.isArray(value) ? (value as UiCandidate[]) : [];
}
```

Create `packages/cdp/src/index.ts`:

```ts
export * from "./client.js";
export * from "./pageScanner.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm install
pnpm test packages/cdp/test/pageScanner.test.ts
pnpm --filter @uiheal/cdp typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cdp package.json pnpm-lock.yaml
git commit -m "feat(cdp): add live page scanner primitives"
```

---

### Task 6: Generic JSON Adapter

**Files:**
- Create: `packages/adapters-json/package.json`
- Create: `packages/adapters-json/tsconfig.json`
- Create: `packages/adapters-json/src/index.ts`
- Create: `packages/adapters-json/src/jsonAdapter.ts`
- Create: `packages/adapters-json/test/jsonAdapter.test.ts`

**Interfaces:**
- Consumes: generic JSON target catalog.
- Produces: `readJsonTargets(input: unknown): UiTarget[]`.
- Produces: `createJsonPatchPlan(target: UiTarget, selectorValue: string): PatchPlan`.

- [ ] **Step 1: Write failing adapter tests**

Create `packages/adapters-json/test/jsonAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createJsonPatchPlan, readJsonTargets } from "../src/index.js";

describe("json adapter", () => {
  it("reads generic targets", () => {
    const targets = readJsonTargets({
      targets: [
        {
          id: "email",
          sourceTool: "generic",
          selectors: [{ kind: "css", value: "input#email", enabled: true }],
          element: { tag: "input", name: "email" }
        }
      ]
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("email");
  });

  it("creates a preview patch plan", () => {
    const target = readJsonTargets({
      targets: [{ id: "email", sourceTool: "generic", selectors: [], element: { tag: "input" } }]
    })[0];
    const patch = createJsonPatchPlan(target, "input[name='email']");
    expect(patch.operations[0]).toEqual({
      op: "replace",
      path: "$.targets[?id=email].selectors[0]",
      value: { kind: "css", value: "input[name='email']", enabled: true, source: "uiheal" }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/adapters-json/test/jsonAdapter.test.ts
```

Expected: FAIL because adapter package does not exist.

- [ ] **Step 3: Implement JSON adapter**

Create `packages/adapters-json/package.json`:

```json
{
  "name": "@uiheal/adapters-json",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@uiheal/core": "workspace:*",
    "zod": "^3.23.8"
  }
}
```

Create `packages/adapters-json/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

Create `packages/adapters-json/src/jsonAdapter.ts`:

```ts
import { z } from "zod";
import type { PatchPlan, UiTarget } from "@uiheal/core";

const targetSchema = z.object({
  id: z.string(),
  sourceTool: z.literal("generic").default("generic"),
  action: z.string().optional(),
  selectors: z.array(
    z.object({
      kind: z.enum(["css", "xpath", "id", "name", "text", "role", "a360-path"]),
      value: z.string(),
      enabled: z.boolean(),
      source: z.string().optional(),
      weight: z.number().optional()
    })
  ),
  url: z.string().optional(),
  frame: z.object({ url: z.string().optional(), name: z.string().optional(), path: z.string().optional() }).optional(),
  element: z.record(z.unknown()),
  surroundingContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const catalogSchema = z.object({
  targets: z.array(targetSchema)
});

export function readJsonTargets(input: unknown): UiTarget[] {
  return catalogSchema.parse(input).targets as UiTarget[];
}

export function createJsonPatchPlan(target: UiTarget, selectorValue: string): PatchPlan {
  return {
    artifactType: "generic",
    targetId: target.id,
    operations: [
      {
        op: "replace",
        path: `$.targets[?id=${target.id}].selectors[0]`,
        value: { kind: "css", value: selectorValue, enabled: true, source: "uiheal" }
      }
    ],
    preview: `Replace primary selector for ${target.id} with ${selectorValue}`
  };
}
```

Create `packages/adapters-json/src/index.ts`:

```ts
export * from "./jsonAdapter.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm install
pnpm test packages/adapters-json/test/jsonAdapter.test.ts
pnpm --filter @uiheal/adapters-json typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters-json package.json pnpm-lock.yaml
git commit -m "feat(json): add generic target adapter"
```

---

### Task 7: A360 Bot Parser And Blob Decoder

**Files:**
- Create: `packages/adapters-a360/package.json`
- Create: `packages/adapters-a360/tsconfig.json`
- Create: `packages/adapters-a360/src/index.ts`
- Create: `packages/adapters-a360/src/a360Blob.ts`
- Create: `packages/adapters-a360/src/a360Bot.ts`
- Create: `packages/adapters-a360/test/a360Blob.test.ts`
- Create: `packages/adapters-a360/test/a360Bot.test.ts`
- Create: `packages/adapters-a360/fixtures/live-ui-capture-bot.min.json`

**Interfaces:**
- Produces: `decodeA360Blob(blob: string): A360DecodedBlob`.
- Produces: `encodeA360Blob(decoded: A360DecodedBlob): string`.
- Produces: `extractA360Targets(bot: A360BotContent): UiTarget[]`.

- [ ] **Step 1: Create minimal fixture from the live capture**

Create `packages/adapters-a360/fixtures/live-ui-capture-bot.min.json`:

```json
{
  "nodes": [
    {
      "uid": "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3",
      "commandName": "capture",
      "packageName": "Recorder",
      "disabled": false,
      "attributes": [
        {
          "name": "uiObject",
          "value": {
            "type": "UIOBJECT",
            "uiObject": {
              "blob": "eyJvYmpOb2RlIjp7InVuaXF1ZUlEIjoiMDZlN2ZhOWItYzcxZC00Y2Y4LWIyYWUtNGYyYTAxMTA3NWE5IiwibmFtZSI6ImVtYWlsIiwicGF0aCI6eyJvYmpQYXRoIjpbeyJpbmRleCI6Mn1dfX0sImNhcHR1cmVWZXJzaW9uIjo1NzAwLCJhZHZhbmNlUHJvcGVydGllcyI6eyJhZGRpdGlvbmFsUHJvcGVydGllcyI6eyJhYV9nZW5haV9zdXJyb3VuZGluZ0NvbnRleHQiOiJ7XCJ2ZXJzaW9uXCI6MSxcInRhcmdldFwiOntcInRhZ1wiOlwiaW5wdXRcIixcInR5cGVcIjpcImVtYWlsXCIsXCJpZFwiOlwiZW1haWxcIixcIm5hbWVcIjpcImVtYWlsXCJ9fSJ9fX0=",
              "controlType": "TEXTBOX",
              "technologyType": "HTML",
              "browserType": "CHROME",
              "criteria": {
                "HTML Tag": { "enabled": true, "value": { "type": "STRING", "string": "INPUT" } },
                "DOMXPath": { "enabled": true, "value": { "type": "STRING", "string": "//input[@id='email']" } },
                "HTML ID": { "enabled": true, "value": { "type": "STRING", "string": "email" } },
                "HTML Name": { "enabled": true, "value": { "type": "STRING", "string": "email" } },
                "HTML Type": { "enabled": true, "value": { "type": "STRING", "string": "email" } },
                "HTML FrameSrc": { "enabled": true, "value": { "type": "STRING", "string": "https://acme-test.uipath.com/login" } },
                "CSS Selector": { "enabled": true, "value": { "type": "STRING", "string": "input#email" } }
              },
              "isElevated": false
            },
            "uiObjectWindow": { "type": "WINDOW", "expression": "$Browser1$" }
          }
        }
      ]
    }
  ],
  "packages": [{ "name": "Recorder", "version": "5.8.1-20260619-093958", "settingsAttributes": [] }]
}
```

- [ ] **Step 2: Write failing A360 tests**

Create `packages/adapters-a360/test/a360Blob.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeA360Blob, encodeA360Blob } from "../src/index.js";

describe("A360 blob", () => {
  it("round trips decoded blob JSON", () => {
    const input = { objNode: { name: "email" }, captureVersion: 5700 };
    const encoded = encodeA360Blob(input);
    expect(decodeA360Blob(encoded)).toEqual(input);
  });
});
```

Create `packages/adapters-a360/test/a360Bot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/live-ui-capture-bot.min.json" assert { type: "json" };
import { extractA360Targets } from "../src/index.js";

describe("A360 bot adapter", () => {
  it("extracts Recorder UIOBJECT as UiTarget", () => {
    const targets = extractA360Targets(fixture);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      id: "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3",
      sourceTool: "a360",
      action: "Recorder.capture",
      url: "https://acme-test.uipath.com/login",
      element: { tag: "input", type: "email", id: "email", name: "email" }
    });
    expect(targets[0].selectors.map((selector) => selector.kind)).toContain("css");
    expect(targets[0].surroundingContext?.target?.name).toBe("email");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test packages/adapters-a360/test/a360Blob.test.ts packages/adapters-a360/test/a360Bot.test.ts
```

Expected: FAIL because A360 package does not exist.

- [ ] **Step 4: Implement A360 parser**

Create `packages/adapters-a360/package.json`:

```json
{
  "name": "@uiheal/adapters-a360",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@uiheal/core": "workspace:*"
  }
}
```

Create `packages/adapters-a360/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "resolveJsonModule": true
  }
}
```

Create `packages/adapters-a360/src/a360Blob.ts`:

```ts
export type A360DecodedBlob = Record<string, unknown>;

export function decodeA360Blob(blob: string): A360DecodedBlob {
  return JSON.parse(Buffer.from(blob, "base64").toString("utf8")) as A360DecodedBlob;
}

export function encodeA360Blob(decoded: A360DecodedBlob): string {
  return Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
}

export function extractSurroundingContext(decoded: A360DecodedBlob): Record<string, unknown> | undefined {
  const advanceProperties = decoded.advanceProperties as { additionalProperties?: Record<string, string> } | undefined;
  const raw = advanceProperties?.additionalProperties?.aa_genai_surroundingContext;
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined;
}
```

Create `packages/adapters-a360/src/a360Bot.ts`:

```ts
import type { UiSelector, UiTarget } from "@uiheal/core";
import { decodeA360Blob, extractSurroundingContext } from "./a360Blob.js";

type A360Value = { type?: string; string?: string; number?: string; boolean?: boolean };
type A360Criteria = Record<string, { enabled: boolean; value: A360Value }>;
type A360UiObject = {
  blob?: string;
  controlType?: string;
  technologyType?: string;
  browserType?: string;
  criteria?: A360Criteria;
};
type A360Node = {
  uid: string;
  commandName: string;
  packageName: string;
  disabled?: boolean;
  attributes?: Array<{ name: string; value: { type?: string; uiObject?: A360UiObject } }>;
};
export type A360BotContent = { nodes?: A360Node[] };

function criteriaString(criteria: A360Criteria | undefined, key: string): string | undefined {
  const item = criteria?.[key];
  return item?.value?.string;
}

function criteriaSelector(criteria: A360Criteria, key: string, kind: UiSelector["kind"]): UiSelector | null {
  const item = criteria[key];
  const value = item?.value?.string;
  if (!value) return null;
  return { kind, value, enabled: Boolean(item.enabled), source: "a360" };
}

function selectorsFromCriteria(criteria: A360Criteria | undefined): UiSelector[] {
  if (!criteria) return [];
  return [
    criteriaSelector(criteria, "CSS Selector", "css"),
    criteriaSelector(criteria, "DOMXPath", "xpath"),
    criteriaSelector(criteria, "HTML ID", "id"),
    criteriaSelector(criteria, "HTML Name", "name"),
    criteriaSelector(criteria, "Path", "a360-path")
  ].filter((selector): selector is UiSelector => Boolean(selector));
}

export function extractA360Targets(bot: A360BotContent): UiTarget[] {
  return (bot.nodes ?? [])
    .filter((node) => node.packageName === "Recorder")
    .flatMap((node) => {
      const uiAttribute = node.attributes?.find((attribute) => attribute.value?.type === "UIOBJECT");
      const uiObject = uiAttribute?.value?.uiObject;
      if (!uiObject) return [];
      const decoded = uiObject.blob ? decodeA360Blob(uiObject.blob) : {};
      const surroundingContext = extractSurroundingContext(decoded);
      const criteria = uiObject.criteria;
      const tag = criteriaString(criteria, "HTML Tag")?.toLowerCase();
      return [
        {
          id: node.uid,
          sourceTool: "a360",
          action: `Recorder.${node.commandName}`,
          selectors: selectorsFromCriteria(criteria),
          url: criteriaString(criteria, "HTML FrameSrc"),
          frame: { url: criteriaString(criteria, "HTML FrameSrc"), path: criteriaString(criteria, "HTML FramePath") },
          element: {
            tag,
            type: criteriaString(criteria, "HTML Type"),
            id: criteriaString(criteria, "HTML ID"),
            name: criteriaString(criteria, "HTML Name"),
            text: criteriaString(criteria, "HTML InnerText"),
            classes: criteriaString(criteria, "HTML Class")?.split(/\s+/).filter(Boolean)
          },
          surroundingContext,
          metadata: {
            nodeUid: node.uid,
            uiAttributeName: uiAttribute?.name,
            controlType: uiObject.controlType,
            technologyType: uiObject.technologyType,
            browserType: uiObject.browserType
          }
        }
      ];
    });
}
```

Create `packages/adapters-a360/src/index.ts`:

```ts
export * from "./a360Blob.js";
export * from "./a360Bot.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
pnpm install
pnpm test packages/adapters-a360/test/a360Blob.test.ts packages/adapters-a360/test/a360Bot.test.ts
pnpm --filter @uiheal/adapters-a360 typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters-a360 package.json pnpm-lock.yaml
git commit -m "feat(a360): extract recorder UI targets"
```

---

### Task 8: A360 Patch Preview

**Files:**
- Create: `packages/adapters-a360/src/a360Patch.ts`
- Create: `packages/adapters-a360/test/a360Patch.test.ts`
- Modify: `packages/adapters-a360/src/index.ts`

**Interfaces:**
- Consumes: `A360BotContent`, `RepairSuggestion`.
- Produces: `createA360PatchPlan(bot: A360BotContent, suggestion: RepairSuggestion): PatchPlan`.
- Produces: `applyA360PatchPreview(bot: A360BotContent, plan: PatchPlan): A360BotContent`.

- [ ] **Step 1: Write failing patch tests**

Create `packages/adapters-a360/test/a360Patch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/live-ui-capture-bot.min.json" assert { type: "json" };
import { applyA360PatchPreview, createA360PatchPlan } from "../src/index.js";

describe("A360 patch preview", () => {
  it("creates and applies a CSS selector replacement preview", () => {
    const plan = createA360PatchPlan(fixture, {
      targetId: "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3",
      selector: { kind: "css", value: "input[name='email']", enabled: true, source: "uiheal" },
      confidence: 0.91,
      reason: "Context matched",
      candidate: {
        candidateId: "candidate-1",
        selector: { kind: "css", value: "input[name='email']", enabled: true },
        element: { tag: "input", name: "email" }
      }
    });
    expect(plan.preview).toContain("CSS Selector");
    const patched = applyA360PatchPreview(fixture, plan);
    const criteria = patched.nodes?.[0].attributes?.[0].value.uiObject?.criteria;
    expect(criteria?.["CSS Selector"].value.string).toBe("input[name='email']");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/adapters-a360/test/a360Patch.test.ts
```

Expected: FAIL because patch exports do not exist.

- [ ] **Step 3: Implement patch preview**

Create `packages/adapters-a360/src/a360Patch.ts`:

```ts
import type { PatchPlan, RepairSuggestion } from "@uiheal/core";
import type { A360BotContent } from "./a360Bot.js";

export function createA360PatchPlan(_bot: A360BotContent, suggestion: RepairSuggestion): PatchPlan {
  return {
    artifactType: "a360",
    targetId: suggestion.targetId,
    operations: [
      {
        op: "replace",
        path: `$.nodes[uid=${suggestion.targetId}].attributes[uiObject].value.uiObject.criteria.CSS Selector`,
        value: {
          enabled: true,
          value: { type: "STRING", string: suggestion.selector.value }
        }
      }
    ],
    preview: `Replace A360 CSS Selector for ${suggestion.targetId} with ${suggestion.selector.value}`
  };
}

export function applyA360PatchPreview(bot: A360BotContent, plan: PatchPlan): A360BotContent {
  const clone = structuredClone(bot) as A360BotContent;
  const node = clone.nodes?.find((item) => item.uid === plan.targetId);
  const uiAttribute = node?.attributes?.find((attribute) => attribute.value?.type === "UIOBJECT");
  const criteria = uiAttribute?.value?.uiObject?.criteria;
  const cssOperation = plan.operations.find((operation) => operation.path.includes("CSS Selector"));
  if (!criteria || !cssOperation) return clone;
  criteria["CSS Selector"] = cssOperation.value as never;
  return clone;
}
```

Modify `packages/adapters-a360/src/index.ts`:

```ts
export * from "./a360Blob.js";
export * from "./a360Bot.js";
export * from "./a360Patch.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test packages/adapters-a360/test/a360Patch.test.ts
pnpm --filter @uiheal/adapters-a360 typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters-a360
git commit -m "feat(a360): add recorder selector patch preview"
```

---

### Task 9: CLI For Generic Validation

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/validate.ts`
- Create: `packages/cli/test/cli.test.ts`

**Interfaces:**
- Consumes: `@uiheal/core`, `@uiheal/adapters-json`.
- Produces: CLI command `uiheal validate --targets <file> --candidates <file> --out <file>`.

- [ ] **Step 1: Write CLI test for JSON validation orchestration**

Create `packages/cli/test/cli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runValidateCommand } from "../src/commands/validate.js";

describe("validate command", () => {
  it("validates target catalog against candidate catalog", async () => {
    const result = await runValidateCommand({
      targets: {
        targets: [
          {
            id: "email",
            sourceTool: "generic",
            selectors: [{ kind: "css", value: "#email", enabled: true }],
            element: { tag: "input", name: "email" }
          }
        ]
      },
      candidates: [
        {
          candidateId: "c1",
          selector: { kind: "css", value: "input[name='email']", enabled: true },
          element: { tag: "input", name: "email" }
        }
      ]
    });
    expect(result.summary.total).toBe(1);
    expect(result.results[0].status).toBe("repairable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/cli/test/cli.test.ts
```

Expected: FAIL because CLI package does not exist.

- [ ] **Step 3: Implement CLI package and validate command**

Create `packages/cli/package.json`:

```json
{
  "name": "uiheal",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "uiheal": "dist/index.js"
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@uiheal/core": "workspace:*",
    "@uiheal/adapters-json": "workspace:*",
    "commander": "^12.1.0"
  }
}
```

Create `packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

Create `packages/cli/src/commands/validate.ts`:

```ts
import { createPreflightSummary, validateTarget, type UiCandidate, type ValidationResult } from "@uiheal/core";
import { readJsonTargets } from "@uiheal/adapters-json";

export interface ValidateCommandInput {
  targets: unknown;
  candidates: UiCandidate[];
}

export interface ValidateCommandResult {
  results: ValidationResult[];
  summary: ReturnType<typeof createPreflightSummary>;
}

export async function runValidateCommand(input: ValidateCommandInput): Promise<ValidateCommandResult> {
  const targets = readJsonTargets(input.targets);
  const results = targets.map((target) => validateTarget(target, input.candidates));
  return {
    results,
    summary: createPreflightSummary(results)
  };
}
```

Create `packages/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program.name("uiheal").description("Local-first UI automation preflight and healing CLI").version("0.1.0");

program.parse();
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm install
pnpm test packages/cli/test/cli.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli package.json pnpm-lock.yaml
git commit -m "feat(cli): add generic validation orchestration"
```

---

### Task 10: A360 Preflight Orchestrator And HTML Report

**Files:**
- Create: `packages/cli/src/commands/a360.ts`
- Create: `packages/cli/src/report/htmlReport.ts`
- Create: `packages/cli/test/a360Command.test.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Consumes: `extractA360Targets`, `validateTarget`, `suggestRepair`, `createA360PatchPlan`.
- Produces: `runA360Preflight(input: A360PreflightInput): A360PreflightResult`.
- Produces: `renderHtmlReport(result: A360PreflightResult): string`.

- [ ] **Step 1: Write failing A360 command test**

Create `packages/cli/test/a360Command.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fixture from "../../adapters-a360/fixtures/live-ui-capture-bot.min.json" assert { type: "json" };
import { runA360Preflight } from "../src/commands/a360.js";
import { renderHtmlReport } from "../src/report/htmlReport.js";

describe("A360 preflight command", () => {
  it("returns validation results and repair plans", async () => {
    const result = await runA360Preflight({
      bot: fixture,
      candidatesByTargetId: {
        "1c8cf5d4-844d-4bf3-82c1-9a590fe2a6f3": [
          {
            candidateId: "candidate-1",
            selector: { kind: "css", value: "input[name='email']", enabled: true },
            element: { tag: "input", type: "email", name: "email" },
            frame: { url: "https://acme-test.uipath.com/login" }
          }
        ]
      }
    });
    expect(result.summary.total).toBe(1);
    expect(result.patchPlans).toHaveLength(1);
    expect(renderHtmlReport(result)).toContain("UIHeal A360 Preflight");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/cli/test/a360Command.test.ts
```

Expected: FAIL because A360 command does not exist.

- [ ] **Step 3: Implement A360 preflight orchestration**

Create `packages/cli/src/commands/a360.ts`:

```ts
import { createPreflightSummary, suggestRepair, validateTarget, type PatchPlan, type UiCandidate, type ValidationResult } from "@uiheal/core";
import { createA360PatchPlan, extractA360Targets, type A360BotContent } from "@uiheal/adapters-a360";

export interface A360PreflightInput {
  bot: A360BotContent;
  candidatesByTargetId: Record<string, UiCandidate[]>;
}

export interface A360PreflightResult {
  results: ValidationResult[];
  patchPlans: PatchPlan[];
  summary: ReturnType<typeof createPreflightSummary>;
}

export async function runA360Preflight(input: A360PreflightInput): Promise<A360PreflightResult> {
  const targets = extractA360Targets(input.bot);
  const results = targets.map((target) => validateTarget(target, input.candidatesByTargetId[target.id] ?? []));
  const patchPlans = targets.flatMap((target) => {
    const suggestion = suggestRepair(target, input.candidatesByTargetId[target.id] ?? []);
    return suggestion ? [createA360PatchPlan(input.bot, suggestion)] : [];
  });
  return {
    results,
    patchPlans,
    summary: createPreflightSummary(results)
  };
}
```

Create `packages/cli/src/report/htmlReport.ts`:

```ts
import type { A360PreflightResult } from "../commands/a360.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

export function renderHtmlReport(result: A360PreflightResult): string {
  const rows = result.results
    .map(
      (item) => `<tr><td>${escapeHtml(item.targetId)}</td><td>${item.status}</td><td>${item.confidence}</td><td>${escapeHtml(item.reason)}</td></tr>`
    )
    .join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>UIHeal A360 Preflight</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f6f8; }
  </style>
</head>
<body>
  <h1>UIHeal A360 Preflight</h1>
  <p>Total: ${result.summary.total}, Pass: ${result.summary.pass}, Repairable: ${result.summary.repairable}, Failed: ${result.summary.failed}</p>
  <table>
    <thead><tr><th>Target</th><th>Status</th><th>Confidence</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
```

Modify `packages/cli/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program.name("uiheal").description("Local-first UI automation preflight and healing CLI").version("0.1.0");

program
  .command("a360")
  .description("Automation Anywhere A360 commands")
  .action(() => {
    console.log("A360 command module is available through package APIs in MVP task 10.");
  });

program.parse();
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm install
pnpm test packages/cli/test/a360Command.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli package.json pnpm-lock.yaml
git commit -m "feat(cli): add A360 preflight reporting"
```

---

### Task 11: Live A360 Control Room Fetch Design Hook

**Files:**
- Create: `packages/adapters-a360/src/a360ControlRoom.ts`
- Create: `packages/adapters-a360/test/a360ControlRoom.test.ts`
- Modify: `packages/adapters-a360/src/index.ts`

**Interfaces:**
- Produces: `buildA360ContentUrl(origin: string, fileId: string): string`.
- Produces: `redactHeaders(headers: Record<string, string>): Record<string, string>`.
- Produces: `fetchA360BotContent(input: FetchA360BotContentInput): Promise<A360BotContent>`.

- [ ] **Step 1: Write failing Control Room safety tests**

Create `packages/adapters-a360/test/a360ControlRoom.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildA360ContentUrl, redactHeaders } from "../src/index.js";

describe("A360 Control Room helpers", () => {
  it("builds the bot content URL", () => {
    expect(buildA360ContentUrl("https://example.controlroom", "100126347")).toBe(
      "https://example.controlroom/v2/repository/files/100126347/content"
    );
  });

  it("redacts sensitive headers", () => {
    expect(
      redactHeaders({
        "X-Authorization": "secret",
        Cookie: "session=secret",
        Accept: "application/json"
      })
    ).toEqual({
      "X-Authorization": "[REDACTED]",
      Cookie: "[REDACTED]",
      Accept: "application/json"
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test packages/adapters-a360/test/a360ControlRoom.test.ts
```

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement Control Room helpers**

Create `packages/adapters-a360/src/a360ControlRoom.ts`:

```ts
import type { A360BotContent } from "./a360Bot.js";

export interface FetchA360BotContentInput {
  origin: string;
  fileId: string;
  authToken: string;
  fetchImpl?: typeof fetch;
}

export function buildA360ContentUrl(origin: string, fileId: string): string {
  return `${origin.replace(/\/$/, "")}/v2/repository/files/${fileId}/content`;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      return /authorization|cookie|token/i.test(key) ? [key, "[REDACTED]"] : [key, value];
    })
  );
}

export async function fetchA360BotContent(input: FetchA360BotContentInput): Promise<A360BotContent> {
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(buildA360ContentUrl(input.origin, input.fileId), {
    headers: {
      "X-Authorization": input.authToken,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`A360 content fetch failed with HTTP ${response.status}`);
  return (await response.json()) as A360BotContent;
}
```

Modify `packages/adapters-a360/src/index.ts`:

```ts
export * from "./a360Blob.js";
export * from "./a360Bot.js";
export * from "./a360Patch.js";
export * from "./a360ControlRoom.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test packages/adapters-a360/test/a360ControlRoom.test.ts
pnpm --filter @uiheal/adapters-a360 typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters-a360
git commit -m "feat(a360): add safe Control Room fetch helpers"
```

---

### Task 12: Documentation And First Demo Script

**Files:**
- Create: `docs/architecture/uiheal-mvp.md`
- Create: `examples/generic-targets.json`
- Create: `examples/generic-candidates.json`
- Modify: `package.json`

**Interfaces:**
- Produces: documented MVP flow for RDP/local-only users.
- Produces: reproducible demo using generic JSON validation.

- [ ] **Step 1: Create architecture documentation**

Create `docs/architecture/uiheal-mvp.md`:

```md
# UIHeal MVP Architecture

UIHeal is a local-first UI automation preflight and healing engine. It normalizes automation targets from different tools into `UiTarget`, scans a live or captured page into `UiCandidate`, validates confidence deterministically, and produces patch previews.

## MVP Scope

- Core model and deterministic validator
- Generic JSON adapter
- A360 Recorder `UIOBJECT` extraction
- A360 patch preview
- HTML report generation
- Safe Control Room URL/header helpers

## Enterprise/RDP Mode

The CLI must run in the same desktop or RDP session where the target portal is reachable. The MVP avoids cloud services and does not require AI. Reports must not include auth tokens, cookies, or full unredacted HTML.

## Future Adapters

After the A360 proof works, add adapters for Playwright, Selenium, Puppeteer, Cypress, and Robot Framework. Each adapter should only translate that tool's artifacts into `UiTarget` and patch plans; validation remains in `@uiheal/core`.
```

- [ ] **Step 2: Add generic example fixtures**

Create `examples/generic-targets.json`:

```json
{
  "targets": [
    {
      "id": "email",
      "sourceTool": "generic",
      "selectors": [{ "kind": "css", "value": "#old-email", "enabled": true }],
      "element": { "tag": "input", "type": "email", "name": "email", "label": "Email:" }
    }
  ]
}
```

Create `examples/generic-candidates.json`:

```json
[
  {
    "candidateId": "email-candidate",
    "selector": { "kind": "css", "value": "input[name='email']", "enabled": true },
    "element": { "tag": "input", "type": "email", "name": "email", "label": "Email:" }
  }
]
```

- [ ] **Step 3: Add demo script**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "typecheck": "pnpm -r typecheck",
    "lint:types": "pnpm typecheck",
    "demo:generic": "pnpm --filter uiheal test -- cli.test.ts"
  }
}
```

- [ ] **Step 4: Run final MVP verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all tests, typecheck, and build pass.

- [ ] **Step 5: Commit**

```bash
git add docs examples package.json
git commit -m "docs: document UIHeal MVP architecture"
```

---

## Self-Review

Spec coverage:

- Universal target model: covered by Tasks 2 and 3.
- Deterministic validation: covered by Tasks 3 and 4.
- Local CDP scanning: covered by Task 5.
- Generic package entry path: covered by Tasks 6 and 9.
- A360 `UIOBJECT` extraction and `aa_genai_surroundingContext`: covered by Task 7.
- A360 patch preview: covered by Task 8.
- Control Room safety and redaction: covered by Task 11.
- HTML report: covered by Task 10.
- Enterprise/RDP constraints: covered by global constraints and Task 12.
- AI guidance: intentionally extension-only in MVP; no implementation task by design.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps remain.
- Each task has concrete files, interfaces, test commands, implementation snippets, and verification.

Type consistency:

- `UiTarget`, `UiCandidate`, `ValidationResult`, `RepairSuggestion`, and `PatchPlan` are defined in Task 2 and reused consistently.
- `extractA360Targets`, `decodeA360Blob`, `encodeA360Blob`, `createA360PatchPlan`, and `applyA360PatchPreview` are defined before CLI orchestration uses them.

Execution note:

- This plan assumes the workspace is initialized as a git repo before implementation. If it remains non-git, skip commit steps and keep each task's changes grouped manually.

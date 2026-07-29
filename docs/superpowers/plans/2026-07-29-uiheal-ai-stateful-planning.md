# UIHeal AI Stateful Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional OpenRouter-powered guidance and stateful preflight planning so UIHeal can detect login-required automation states, generate reviewable Playwright setup scripts, and safely prepare browser state before scanning post-login targets.

**Architecture:** Add a new `@uiheal/ai` package for redacted OpenRouter guidance and state-planning prompts, a new `@uiheal/state-planner` package for deterministic state grouping/login detection, and CLI integration in `uiheal a360 preflight`. Deterministic scanning remains first; AI only receives compact redacted evidence and never receives credentials, cookies, auth tokens, or full page HTML.

**Tech Stack:** Node.js 20+, TypeScript, pnpm workspaces, Vitest, Commander, native `fetch`, OpenRouter chat completions API, optional Playwright script generation as text artifacts.

## Global Constraints

- AI is optional. `--ai off` must preserve the current deterministic workflow.
- OpenRouter calls require `OPENROUTER_API_KEY`; missing API key must produce a warning, not fail preflight.
- Default AI model is `process.env.UIHEAL_AI_MODEL || "openrouter/auto"`.
- AI prompts must never include cookies, A360 auth tokens, bearer tokens, passwords, complete HTML, screenshots, or raw request headers.
- Stateful planning has three modes: `manual`, `assist`, and `execute`.
- `manual` only reports what browser state is missing.
- `assist` generates a Playwright setup script for human review.
- `execute` must require all of: `--execute-state-plan`, `--allow-origin <origin>`, and explicit credential environment variables when credentials are needed.
- Generated Playwright setup scripts must use environment variables for credentials, such as `UIHEAL_LOGIN_USER` and `UIHEAL_LOGIN_PASS`.
- No destructive actions may be generated or executed: delete, approve, submit payment, export sensitive data, admin changes, or irreversible workflow actions.
- Every task must pass targeted tests plus `pnpm typecheck` for touched packages.

---

## File Structure

Create or modify:

```text
packages/
  ai/
    package.json
    tsconfig.json
    src/index.ts
    src/openRouterClient.ts
    src/redaction.ts
    src/guidancePrompt.ts
    src/statePlanPrompt.ts
    src/types.ts
    test/openRouterClient.test.ts
    test/redaction.test.ts
    test/guidancePrompt.test.ts
    test/statePlanPrompt.test.ts
  state-planner/
    package.json
    tsconfig.json
    src/index.ts
    src/groupTargets.ts
    src/loginDetector.ts
    src/statePlan.ts
    src/playwrightScript.ts
    src/safety.ts
    test/groupTargets.test.ts
    test/loginDetector.test.ts
    test/statePlan.test.ts
    test/playwrightScript.test.ts
    test/safety.test.ts
  cli/
    src/commands/a360Live.ts
    src/report/htmlReport.ts
    src/report/jsonReport.ts
    test/aiGuidanceCli.test.ts
    test/statefulPreflight.test.ts
docs/
  architecture/
    ai-guidance-openrouter.md
    stateful-preflight-flow.md
examples/
  state-plan.review.playwright.ts
```

---

### Task 1: AI Package Scaffold And Types

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/index.ts`

**Interfaces:**
- Produces: `OpenRouterMessage`, `OpenRouterOptions`, `AiGuidanceClient`.
- Produces: `GuidancePromptInput`, `AiGuidanceResult`, `StatePlanPromptInput`.

- [ ] **Step 1: Create package files**

Create `packages/ai/package.json`:

```json
{
  "name": "@uiheal/ai",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@uiheal/core": "workspace:*"
  }
}
```

Create `packages/ai/tsconfig.json`:

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

Create `packages/ai/src/types.ts`:

```ts
import type { PatchPlan, UiCandidate, UiTarget, ValidationResult } from "@uiheal/core";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface AiGuidanceClient {
  complete(messages: OpenRouterMessage[]): Promise<string>;
}

export interface GuidancePromptInput {
  target: UiTarget;
  validation: ValidationResult;
  candidates: UiCandidate[];
  patchPlan?: PatchPlan;
}

export interface AiGuidanceResult {
  provider: "openrouter";
  model: string;
  summary: string;
  recommendedAction: string;
  rawText?: string;
  warning?: string;
}

export interface StatePlanPromptInput {
  states: unknown[];
  loginIndicators: unknown[];
  allowedOrigin?: string;
  mode: "manual" | "assist" | "execute";
}
```

Create `packages/ai/src/index.ts`:

```ts
export * from "./types.js";
```

- [ ] **Step 2: Verify**

Run:

```bash
pnpm install
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 2: Redaction Engine

**Files:**
- Create: `packages/ai/src/redaction.ts`
- Create: `packages/ai/test/redaction.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Produces: `redactGuidanceEvidence(input: unknown): unknown`.
- Produces: `redactText(value: string): string`.

- [ ] **Step 1: Write failing redaction tests**

Create `packages/ai/test/redaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redactGuidanceEvidence, redactText } from "../src/index.js";

describe("AI redaction", () => {
  it("redacts token-like text", () => {
    expect(redactText("Authorization: Bearer abc123")).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts sensitive object keys recursively", () => {
    expect(
      redactGuidanceEvidence({
        headers: { Cookie: "session=secret", Accept: "json" },
        password: "secret",
        selector: "input#email"
      })
    ).toEqual({
      headers: { Cookie: "[REDACTED]", Accept: "json" },
      password: "[REDACTED]",
      selector: "input#email"
    });
  });
});
```

- [ ] **Step 2: Implement redaction**

Create `packages/ai/src/redaction.ts`:

```ts
const sensitiveKeyPattern = /authorization|cookie|token|password|secret|credential|session/i;

export function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)\S+/gi, "$1[REDACTED]");
}

export function redactGuidanceEvidence(input: unknown): unknown {
  if (typeof input === "string") return redactText(input);
  if (Array.isArray(input)) return input.map(redactGuidanceEvidence);
  if (!input || typeof input !== "object") return input;

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (sensitiveKeyPattern.test(key)) return [key, "[REDACTED]"];
      return [key, redactGuidanceEvidence(value)];
    })
  );
}
```

Modify `packages/ai/src/index.ts`:

```ts
export * from "./types.js";
export * from "./redaction.js";
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/ai/test/redaction.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 3: OpenRouter Client

**Files:**
- Create: `packages/ai/src/openRouterClient.ts`
- Create: `packages/ai/test/openRouterClient.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Produces: `createOpenRouterClient(options?: OpenRouterOptions): AiGuidanceClient`.
- Produces: `resolveOpenRouterOptions(options?: OpenRouterOptions): RequiredOpenRouterOptions`.

- [ ] **Step 1: Write failing client tests**

Create `packages/ai/test/openRouterClient.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOpenRouterClient, resolveOpenRouterOptions } from "../src/index.js";

describe("OpenRouter client", () => {
  it("resolves defaults", () => {
    const options = resolveOpenRouterOptions({ apiKey: "key" });
    expect(options.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.model).toBe("openrouter/auto");
  });

  it("posts OpenAI-compatible messages", async () => {
    const calls: any[] = [];
    const client = createOpenRouterClient({
      apiKey: "key",
      model: "openrouter/auto",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      }
    });
    await expect(client.complete([{ role: "user", content: "hello" }])).resolves.toBe("ok");
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].init.headers.Authorization).toBe("Bearer key");
  });

  it("throws when API key is missing", () => {
    expect(() => resolveOpenRouterOptions({ apiKey: "" })).toThrow("OPENROUTER_API_KEY");
  });
});
```

- [ ] **Step 2: Implement client**

Create `packages/ai/src/openRouterClient.ts`:

```ts
import type { AiGuidanceClient, OpenRouterMessage, OpenRouterOptions } from "./types.js";

export interface RequiredOpenRouterOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
}

export function resolveOpenRouterOptions(options: OpenRouterOptions = {}): RequiredOpenRouterOptions {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for AI guidance");
  return {
    apiKey,
    model: options.model || process.env.UIHEAL_AI_MODEL || "openrouter/auto",
    baseUrl: options.baseUrl || "https://openrouter.ai/api/v1/chat/completions",
    fetchImpl: options.fetchImpl || fetch
  };
}

export function createOpenRouterClient(options: OpenRouterOptions = {}): AiGuidanceClient {
  const resolved = resolveOpenRouterOptions(options);
  return {
    async complete(messages: OpenRouterMessage[]): Promise<string> {
      const response = await resolved.fetchImpl(resolved.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolved.apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "UIHeal"
        },
        body: JSON.stringify({
          model: resolved.model,
          messages
        })
      });
      if (!response.ok) throw new Error(`OpenRouter request failed with HTTP ${response.status}`);
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return json.choices?.[0]?.message?.content ?? "";
    }
  };
}
```

Modify `packages/ai/src/index.ts`:

```ts
export * from "./types.js";
export * from "./redaction.js";
export * from "./openRouterClient.js";
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/ai/test/openRouterClient.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 4: Guidance Prompt Builder

**Files:**
- Create: `packages/ai/src/guidancePrompt.ts`
- Create: `packages/ai/test/guidancePrompt.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Produces: `buildGuidancePrompt(input: GuidancePromptInput): OpenRouterMessage[]`.

- [ ] **Step 1: Write failing prompt tests**

Create `packages/ai/test/guidancePrompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGuidancePrompt } from "../src/index.js";

describe("guidance prompt", () => {
  it("builds compact redacted evidence prompt", () => {
    const messages = buildGuidancePrompt({
      target: {
        id: "email",
        sourceTool: "a360",
        selectors: [{ kind: "css", value: "#old", enabled: true }],
        element: { tag: "input", name: "email" },
        metadata: { authToken: "secret" }
      },
      validation: { targetId: "email", status: "repairable", confidence: 0.71, signals: [], reason: "selector failed" },
      candidates: [{ candidateId: "c1", selector: { kind: "css", value: "input[name='email']", enabled: true }, element: { tag: "input", name: "email" } }]
    });
    const text = JSON.stringify(messages);
    expect(text).toContain("repairable");
    expect(text).toContain("input[name='email']");
    expect(text).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Implement prompt builder**

Create `packages/ai/src/guidancePrompt.ts`:

```ts
import type { GuidancePromptInput, OpenRouterMessage } from "./types.js";
import { redactGuidanceEvidence } from "./redaction.js";

export function buildGuidancePrompt(input: GuidancePromptInput): OpenRouterMessage[] {
  const compact = redactGuidanceEvidence({
    target: {
      id: input.target.id,
      sourceTool: input.target.sourceTool,
      action: input.target.action,
      selectors: input.target.selectors,
      url: input.target.url,
      element: input.target.element
    },
    validation: input.validation,
    candidates: input.candidates.slice(0, 5).map((candidate) => ({
      candidateId: candidate.candidateId,
      selector: candidate.selector,
      element: candidate.element,
      url: candidate.url,
      metadata: candidate.metadata
    })),
    patchPreview: input.patchPlan?.preview
  });

  return [
    {
      role: "system",
      content:
        "You are UIHeal guidance. Explain UI automation selector failures using only provided compact evidence. Recommend deterministic selector repairs. Do not ask for secrets or credentials."
    },
    {
      role: "user",
      content: JSON.stringify(compact, null, 2)
    }
  ];
}
```

Modify `packages/ai/src/index.ts` to export it.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/ai/test/guidancePrompt.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 5: State Planner Package Scaffold

**Files:**
- Create: `packages/state-planner/package.json`
- Create: `packages/state-planner/tsconfig.json`
- Create: `packages/state-planner/src/index.ts`
- Create: `packages/state-planner/src/groupTargets.ts`
- Create: `packages/state-planner/test/groupTargets.test.ts`

**Interfaces:**
- Produces: `groupTargetsByState(targets: UiTarget[]): UiTargetStateGroup[]`.

- [ ] **Step 1: Write failing grouping test**

Create `packages/state-planner/test/groupTargets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupTargetsByState } from "../src/index.js";

describe("state grouping", () => {
  it("groups targets by URL path", () => {
    const groups = groupTargetsByState([
      { id: "login-email", sourceTool: "a360", selectors: [], url: "https://portal/login", element: { tag: "input" } },
      { id: "work-table", sourceTool: "a360", selectors: [], url: "https://portal/work-items", element: { tag: "table" } }
    ]);
    expect(groups.map((group) => group.stateId)).toEqual(["/login", "/work-items"]);
  });
});
```

- [ ] **Step 2: Implement grouping**

Create `packages/state-planner/src/groupTargets.ts`:

```ts
import type { UiTarget } from "@uiheal/core";

export interface UiTargetStateGroup {
  stateId: string;
  origin?: string;
  url?: string;
  targets: UiTarget[];
}

function stateIdFor(url?: string): { stateId: string; origin?: string } {
  if (!url) return { stateId: "unknown" };
  const parsed = new URL(url);
  return { stateId: parsed.pathname || "/", origin: parsed.origin };
}

export function groupTargetsByState(targets: UiTarget[]): UiTargetStateGroup[] {
  const groups = new Map<string, UiTargetStateGroup>();
  for (const target of targets) {
    const { stateId, origin } = stateIdFor(target.url);
    const key = `${origin ?? ""}${stateId}`;
    const group = groups.get(key) ?? { stateId, origin, url: target.url, targets: [] };
    group.targets.push(target);
    groups.set(key, group);
  }
  return [...groups.values()];
}
```

Create exports and package config similar to `@uiheal/ai`.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm install
pnpm test packages/state-planner/test/groupTargets.test.ts
pnpm --filter @uiheal/state-planner typecheck
```

Expected: PASS.

---

### Task 6: Login Detector

**Files:**
- Create: `packages/state-planner/src/loginDetector.ts`
- Create: `packages/state-planner/test/loginDetector.test.ts`
- Modify: `packages/state-planner/src/index.ts`

**Interfaces:**
- Produces: `detectLoginRequirement(groups: UiTargetStateGroup[], currentOpenUrls: string[]): LoginRequirement`.

- [ ] **Step 1: Write failing login detector tests**

Create `packages/state-planner/test/loginDetector.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectLoginRequirement } from "../src/index.js";

describe("login detector", () => {
  it("detects post-login state missing when only login page is open", () => {
    const result = detectLoginRequirement(
      [
        { stateId: "/login", origin: "https://portal", url: "https://portal/login", targets: [] },
        { stateId: "/dashboard", origin: "https://portal", url: "https://portal/dashboard", targets: [] }
      ],
      ["https://portal/login"]
    );
    expect(result.required).toBe(true);
    expect(result.missingStates.map((state) => state.stateId)).toEqual(["/dashboard"]);
  });
});
```

- [ ] **Step 2: Implement detector**

Create `loginDetector.ts`:

```ts
import type { UiTargetStateGroup } from "./groupTargets.js";

export interface LoginRequirement {
  required: boolean;
  loginState?: UiTargetStateGroup;
  missingStates: UiTargetStateGroup[];
  reason: string;
}

export function detectLoginRequirement(groups: UiTargetStateGroup[], currentOpenUrls: string[]): LoginRequirement {
  const loginState = groups.find((group) => /login|signin|sign-in|auth/i.test(group.stateId));
  const missingStates = groups.filter((group) => group.url && !currentOpenUrls.some((url) => url.startsWith(group.url ?? "")));
  return {
    required: Boolean(loginState && missingStates.some((group) => group !== loginState)),
    loginState,
    missingStates: missingStates.filter((group) => group !== loginState),
    reason: loginState ? "Login-like state exists and post-login states are not currently open" : "No login-like state detected"
  };
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/state-planner/test/loginDetector.test.ts
pnpm --filter @uiheal/state-planner typecheck
```

Expected: PASS.

---

### Task 7: Playwright Setup Script Generator

**Files:**
- Create: `packages/state-planner/src/playwrightScript.ts`
- Create: `packages/state-planner/test/playwrightScript.test.ts`
- Modify: `packages/state-planner/src/index.ts`

**Interfaces:**
- Produces: `generatePlaywrightSetupScript(input: PlaywrightSetupInput): string`.

- [ ] **Step 1: Write failing script generator test**

Create `packages/state-planner/test/playwrightScript.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generatePlaywrightSetupScript } from "../src/index.js";

describe("Playwright setup script", () => {
  it("uses environment variables for credentials", () => {
    const script = generatePlaywrightSetupScript({
      loginUrl: "https://portal/login",
      usernameSelector: "input[name='email']",
      passwordSelector: "input[name='password']",
      submitSelector: "button[type='submit']",
      expectedUrlPattern: "**/dashboard"
    });
    expect(script).toContain("process.env.UIHEAL_LOGIN_USER");
    expect(script).toContain("process.env.UIHEAL_LOGIN_PASS");
    expect(script).toContain("page.waitForURL");
  });
});
```

- [ ] **Step 2: Implement script generator**

Create `playwrightScript.ts`:

```ts
export interface PlaywrightSetupInput {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  expectedUrlPattern?: string;
}

export function generatePlaywrightSetupScript(input: PlaywrightSetupInput): string {
  return `import { chromium } from "playwright";

const user = process.env.UIHEAL_LOGIN_USER;
const pass = process.env.UIHEAL_LOGIN_PASS;
if (!user || !pass) throw new Error("UIHEAL_LOGIN_USER and UIHEAL_LOGIN_PASS are required");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto(${JSON.stringify(input.loginUrl)});
await page.fill(${JSON.stringify(input.usernameSelector)}, user);
await page.fill(${JSON.stringify(input.passwordSelector)}, pass);
await page.click(${JSON.stringify(input.submitSelector)});
${input.expectedUrlPattern ? `await page.waitForURL(${JSON.stringify(input.expectedUrlPattern)});` : ""}
`;
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/state-planner/test/playwrightScript.test.ts
pnpm --filter @uiheal/state-planner typecheck
```

Expected: PASS.

---

### Task 8: Stateful Safety Rules

**Files:**
- Create: `packages/state-planner/src/safety.ts`
- Create: `packages/state-planner/test/safety.test.ts`
- Modify: `packages/state-planner/src/index.ts`

**Interfaces:**
- Produces: `assertStatePlanExecutionAllowed(input: StatePlanExecutionSafetyInput): void`.
- Produces: `isDestructiveActionText(text: string): boolean`.

- [ ] **Step 1: Write failing safety tests**

Create `packages/state-planner/test/safety.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertStatePlanExecutionAllowed, isDestructiveActionText } from "../src/index.js";

describe("state plan safety", () => {
  it("blocks destructive action text", () => {
    expect(isDestructiveActionText("Delete user")).toBe(true);
    expect(isDestructiveActionText("Sign in")).toBe(false);
  });

  it("requires explicit execution guard", () => {
    expect(() => assertStatePlanExecutionAllowed({ execute: false, allowOrigin: "https://portal" })).toThrow("--execute-state-plan");
    expect(() => assertStatePlanExecutionAllowed({ execute: true, allowOrigin: "" })).toThrow("--allow-origin");
  });
});
```

- [ ] **Step 2: Implement safety**

Create `safety.ts`:

```ts
export interface StatePlanExecutionSafetyInput {
  execute: boolean;
  allowOrigin?: string;
}

export function isDestructiveActionText(text: string): boolean {
  return /delete|remove|approve|payment|pay now|submit payment|admin|export|terminate|disable/i.test(text);
}

export function assertStatePlanExecutionAllowed(input: StatePlanExecutionSafetyInput): void {
  if (!input.execute) throw new Error("Refusing to execute state plan without --execute-state-plan");
  if (!input.allowOrigin) throw new Error("Refusing to execute state plan without --allow-origin");
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/state-planner/test/safety.test.ts
pnpm --filter @uiheal/state-planner typecheck
```

Expected: PASS.

---

### Task 9: State Plan Prompt Builder

**Files:**
- Create: `packages/ai/src/statePlanPrompt.ts`
- Create: `packages/ai/test/statePlanPrompt.test.ts`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Produces: `buildStatePlanPrompt(input: StatePlanPromptInput): OpenRouterMessage[]`.

- [ ] **Step 1: Write failing state prompt test**

Create `packages/ai/test/statePlanPrompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildStatePlanPrompt } from "../src/index.js";

describe("state plan prompt", () => {
  it("asks for reviewable Playwright plan without secrets", () => {
    const messages = buildStatePlanPrompt({
      mode: "assist",
      allowedOrigin: "https://portal",
      states: [{ stateId: "/login" }, { stateId: "/dashboard" }],
      loginIndicators: [{ password: "secret", selector: "input[type='password']" }]
    });
    const text = JSON.stringify(messages);
    expect(text).toContain("Playwright");
    expect(text).toContain("human review");
    expect(text).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Implement prompt**

Create `statePlanPrompt.ts`:

```ts
import type { OpenRouterMessage, StatePlanPromptInput } from "./types.js";
import { redactGuidanceEvidence } from "./redaction.js";

export function buildStatePlanPrompt(input: StatePlanPromptInput): OpenRouterMessage[] {
  const compact = redactGuidanceEvidence(input);
  return [
    {
      role: "system",
      content:
        "You are UIHeal state planner. Generate safe, reviewable Playwright setup plans for preparing browser state before UI automation validation. Never include secrets. Require human review."
    },
    {
      role: "user",
      content: JSON.stringify(compact, null, 2)
    }
  ];
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/ai/test/statePlanPrompt.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 10: CLI AI Option Planning

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/commands/a360Live.ts`
- Create: `packages/cli/test/aiGuidanceCli.test.ts`

**Interfaces:**
- Extends `A360LiveCliOptions` with `ai`, `aiProvider`, `aiModel`, `aiMaxTargets`.
- Produces: `AiCliPlan`.

- [ ] **Step 1: Write failing CLI option test**

Create `packages/cli/test/aiGuidanceCli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planA360LivePreflight } from "../src/commands/a360Live.js";

describe("AI CLI planning", () => {
  it("maps AI guidance flags", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        ai: "guide",
        aiProvider: "openrouter",
        aiModel: "openrouter/auto",
        aiMaxTargets: "3"
      })
    ).toMatchObject({
      ai: {
        mode: "guide",
        provider: "openrouter",
        model: "openrouter/auto",
        maxTargets: 3
      }
    });
  });
});
```

- [ ] **Step 2: Implement option parsing**

In `a360Live.ts`, add:

```ts
ai?: "off" | "guide" | "plan";
aiProvider?: "openrouter";
aiModel?: string;
aiMaxTargets?: string;
```

Plan output:

```ts
ai: {
  mode: options.ai || "off",
  provider: options.aiProvider || "openrouter",
  model: options.aiModel || process.env.UIHEAL_AI_MODEL || "openrouter/auto",
  maxTargets: Number(options.aiMaxTargets || 5)
}
```

- [ ] **Step 3: Add commander flags**

Add to `a360 preflight`:

```ts
.option("--ai <mode>", "AI mode: off, guide, or plan", "off")
.option("--ai-provider <provider>", "AI provider", "openrouter")
.option("--ai-model <model>", "AI model slug")
.option("--ai-max-targets <number>", "Maximum targets to send for AI guidance", "5")
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/cli/test/aiGuidanceCli.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

---

### Task 11: AI Guidance Integration After Deterministic Preflight

**Files:**
- Modify: `packages/cli/src/commands/a360Live.ts`
- Modify: `packages/cli/src/report/htmlReport.ts`
- Modify: `packages/cli/src/report/jsonReport.ts`
- Create: `packages/cli/test/aiGuidanceCli.test.ts`

**Interfaces:**
- Produces AI guidance only for failed/repairable targets.
- Adds `aiGuidance` array or `aiWarning` to preflight result.

- [ ] **Step 1: Add test for missing API key warning**

In `aiGuidanceCli.test.ts`, add a test that runs a pure helper:

```ts
buildAiWarningForMissingKey({ mode: "guide" })
```

Expected warning:

```text
OPENROUTER_API_KEY is missing; deterministic preflight completed without AI guidance.
```

- [ ] **Step 2: Implement helper and integration point**

Add helper:

```ts
export function buildAiWarningForMissingKey(ai: { mode: string }): string | undefined {
  return ai.mode === "off" || process.env.OPENROUTER_API_KEY ? undefined : "OPENROUTER_API_KEY is missing; deterministic preflight completed without AI guidance.";
}
```

In live preflight:

- run deterministic preflight first
- if AI mode is off, return result
- if missing key, return result with warning
- if key exists, build prompts for failed/repairable targets and call OpenRouter

- [ ] **Step 3: Add report rendering**

HTML report should show:

```text
AI guidance warning: ...
```

JSON report should include the warning/result fields naturally.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/cli/test/aiGuidanceCli.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

---

### Task 12: Stateful Preflight Planning Integration

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/commands/a360Live.ts`
- Create: `packages/cli/test/statefulPreflight.test.ts`
- Create: `docs/architecture/stateful-preflight-flow.md`
- Create: `examples/state-plan.review.playwright.ts`

**Interfaces:**
- CLI flags:
  - `--stateful manual|assist|execute`
  - `--allow-origin <origin>`
  - `--execute-state-plan`
  - `--state-plan-out <path>`

- [ ] **Step 1: Write failing stateful plan test**

Create `packages/cli/test/statefulPreflight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planA360LivePreflight } from "../src/commands/a360Live.js";

describe("stateful preflight CLI planning", () => {
  it("maps stateful planning flags", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        stateful: "assist",
        allowOrigin: "https://portal",
        statePlanOut: "reports/state-plan.playwright.ts"
      })
    ).toMatchObject({
      stateful: {
        mode: "assist",
        allowOrigin: "https://portal",
        execute: false,
        statePlanOut: "reports/state-plan.playwright.ts"
      }
    });
  });
});
```

- [ ] **Step 2: Implement option parsing**

Extend `A360LiveCliOptions` and plan output.

- [ ] **Step 3: Add deterministic state planning**

After extracting A360 targets:

1. `groupTargetsByState(targets)`
2. `detectLoginRequirement(groups, pages.map(page => page.url))`
3. if required and mode is `manual`, add report warning
4. if required and mode is `assist`, generate Playwright setup script and write it to `--state-plan-out`
5. if mode is `execute`, call `assertStatePlanExecutionAllowed`

- [ ] **Step 4: Document stateful flow**

Create `docs/architecture/stateful-preflight-flow.md`:

```md
# Stateful Preflight Flow

UIHeal groups targets by page state, detects login-required gaps, and can generate a reviewable Playwright setup script. Execution is disabled unless the operator passes an explicit execution flag and origin allowlist.
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test packages/cli/test/statefulPreflight.test.ts
pnpm --filter uiheal typecheck
pnpm test
```

Expected: PASS.

---

### Task 13: Final Offline And Live Validation

**Files:**
- Modify: `scripts/live-a360-preflight-smoke.ps1`
- Modify: `docs/architecture/live-a360-flow.md`

**Interfaces:**
- Documents:
  - deterministic run
  - AI guide run
  - AI state-plan assist run

- [ ] **Step 1: Update smoke script**

Add optional params:

```powershell
[string]$Ai = "off",
[string]$AiModel = "openrouter/auto",
[string]$Stateful = "manual"
```

Command includes:

```powershell
--ai $Ai --ai-model $AiModel --stateful $Stateful
```

- [ ] **Step 2: Update live docs**

Add test flows:

```powershell
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai off --report html --out reports/a360.html
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai guide --ai-provider openrouter --ai-model openrouter/auto --report html --out reports/a360-ai.html
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai plan --stateful assist --allow-origin https://portal.company.com --state-plan-out reports/state-plan.playwright.ts
```

- [ ] **Step 3: Final verification**

Run:

```bash
pnpm test:e2e:offline
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

---

## Self-Review

Spec coverage:

- OpenRouter support: Tasks 1-4.
- Redaction/privacy requirements: Task 2 and prompt tests.
- AI guidance after deterministic preflight: Tasks 10-11.
- Login-required/stateful planning: Tasks 5-9 and 12.
- Playwright setup script generation: Task 7.
- Execution safety gates: Task 8 and Task 12.
- CLI testing flows: Task 13.

Placeholder scan:

- No unspecified implementation steps remain.
- `execute` mode is planned with guardrails but actual script execution can remain blocked until explicit operator approval and a later execution-specific hardening pass.

Type consistency:

- `OpenRouterMessage`, `GuidancePromptInput`, `StatePlanPromptInput`, `UiTargetStateGroup`, and CLI plan shapes are introduced before use.

Execution recommendation:

- Implement Tasks 1-4 first to add AI guidance safely.
- Implement Tasks 5-9 next to add deterministic state planning.
- Implement Tasks 10-12 to connect AI/state planning to `uiheal a360 preflight`.
- Finish with Task 13 and live manual validation.

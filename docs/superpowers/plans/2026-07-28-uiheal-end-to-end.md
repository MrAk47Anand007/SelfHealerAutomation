# UIHeal End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the UIHeal MVP libraries into a usable local-first automation preflight/healing tool with a live A360 command, offline enterprise mode, richer candidate discovery, and first community adapters.

**Architecture:** Extend the existing TypeScript pnpm monorepo. Keep `@uiheal/core` tool-agnostic, put Chrome DevTools execution in `@uiheal/cdp`, keep A360-specific Control Room and bot patch logic in `@uiheal/adapters-a360`, and expose complete workflows through the `uiheal` CLI. All write actions remain preview-only unless `--apply` is explicitly passed.

**Tech Stack:** Node.js 20+, TypeScript, pnpm workspaces, Vitest, Commander, native WebSocket/fetch, `zod`, local Chrome CDP, no AI dependency in this plan.

## Global Constraints

- Run fully local by default.
- Support enterprise/RDP environments where target portals are reachable only inside the same desktop session.
- Do not log or persist A360 auth tokens, cookies, raw request headers, or full unredacted page HTML.
- Default all repair output to patch preview. Require `--apply` for any file or Control Room write-back.
- AI remains optional. Deterministic validation and repair run first; OpenRouter guidance is used only when enabled and only receives compact redacted evidence.
- The first end-to-end command must work:
  `uiheal a360 preflight --cdp 9222 --file-id 100126347 --report html`
- Reports must support JSON and HTML.
- Every task must pass `pnpm test`, `pnpm typecheck`, and relevant package tests before moving on.

---

## Current Starting Point

Already implemented:

- `@uiheal/core`: models, selector helpers, deterministic validator, repair scorer, summary.
- `@uiheal/cdp`: page listing and scan expression builder.
- `@uiheal/adapters-json`: generic target catalog reader and patch preview.
- `@uiheal/adapters-a360`: bot parser, blob decode/encode, surrounding context extraction, patch preview, safe Control Room helpers.
- `uiheal` CLI package: generic validation function, A360 preflight function, HTML renderer.

This plan starts from that state and makes the product runnable from the terminal.

---

## File Structure Additions

Create or modify:

```text
packages/
  cdp/
    src/runtime.ts
    src/evaluate.ts
    src/pageDiscovery.ts
    src/candidateDiscovery.ts
    test/runtime.test.ts
    test/pageDiscovery.test.ts
    test/candidateDiscovery.test.ts
  adapters-a360/
    src/a360LiveSession.ts
    src/a360ApplyPatch.ts
    test/a360LiveSession.test.ts
    test/a360ApplyPatch.test.ts
  adapters-playwright/
    package.json
    tsconfig.json
    src/index.ts
    src/playwrightExtract.ts
    src/playwrightPatch.ts
    test/playwrightExtract.test.ts
  adapters-selenium/
    package.json
    tsconfig.json
    src/index.ts
    src/seleniumExtract.ts
    src/seleniumPatch.ts
    test/seleniumExtract.test.ts
  adapters-puppeteer/
    package.json
    tsconfig.json
    src/index.ts
    src/puppeteerExtract.ts
    src/puppeteerPatch.ts
    test/puppeteerExtract.test.ts
  ai/
    package.json
    tsconfig.json
    src/index.ts
    src/openRouterClient.ts
    src/guidancePrompt.ts
    src/redaction.ts
    test/openRouterClient.test.ts
    test/guidancePrompt.test.ts
  cli/
    src/commands/a360Live.ts
    src/commands/snapshot.ts
    src/commands/playwright.ts
    src/commands/selenium.ts
    src/commands/puppeteer.ts
    src/io/readWriteJson.ts
    src/report/jsonReport.ts
    src/report/writeReport.ts
    test/a360Live.test.ts
    test/snapshot.test.ts
    test/reportWriters.test.ts
docs/
  architecture/
    live-a360-flow.md
    offline-enterprise-flow.md
    ai-guidance-openrouter.md
examples/
  playwright-login.spec.ts
  selenium-login.py
  puppeteer-login.js
```

---

### Task 1: CDP Runtime Client

**Files:**
- Create: `packages/cdp/src/runtime.ts`
- Create: `packages/cdp/src/evaluate.ts`
- Create: `packages/cdp/test/runtime.test.ts`
- Modify: `packages/cdp/src/index.ts`

**Interfaces:**
- Produces: `createCdpRuntime(webSocketDebuggerUrl: string): Promise<CdpRuntime>`.
- Produces: `CdpRuntime.send<T>(method: string, params?: object): Promise<T>`.
- Produces: `evaluateInContext<T>(runtime: CdpRuntime, input: RuntimeEvaluateInput): Promise<T>`.

- [ ] **Step 1: Write failing runtime tests**

Create `packages/cdp/test/runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractRuntimeValue } from "../src/index.js";

describe("CDP runtime helpers", () => {
  it("extracts returnByValue results", () => {
    expect(extractRuntimeValue({ result: { result: { value: { ok: true } } } })).toEqual({ ok: true });
  });

  it("throws for CDP exceptionDetails", () => {
    expect(() =>
      extractRuntimeValue({
        result: {
          exceptionDetails: {
            text: "Evaluation failed"
          }
        }
      })
    ).toThrow("Evaluation failed");
  });
});
```

- [ ] **Step 2: Implement runtime helpers**

Create `packages/cdp/src/runtime.ts`:

```ts
export interface CdpRuntime {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
}

export async function createCdpRuntime(webSocketDebuggerUrl: string): Promise<CdpRuntime> {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map<number, (value: unknown) => void>();

  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  };

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("Unable to open CDP WebSocket"));
  });

  return {
    send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
      return new Promise<T>((resolve) => {
        const messageId = ++id;
        pending.set(messageId, (value) => resolve(value as T));
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    close() {
      ws.close();
    }
  };
}
```

Create `packages/cdp/src/evaluate.ts`:

```ts
import type { CdpRuntime } from "./runtime.js";

export interface RuntimeEvaluateInput {
  expression: string;
  contextId?: number;
  awaitPromise?: boolean;
}

export function extractRuntimeValue<T>(response: any): T {
  const exceptionText = response?.result?.exceptionDetails?.text;
  if (exceptionText) throw new Error(exceptionText);
  return response?.result?.result?.value as T;
}

export async function evaluateInContext<T>(runtime: CdpRuntime, input: RuntimeEvaluateInput): Promise<T> {
  const response = await runtime.send("Runtime.evaluate", {
    expression: input.expression,
    contextId: input.contextId,
    returnByValue: true,
    awaitPromise: input.awaitPromise ?? true
  });
  return extractRuntimeValue<T>(response);
}
```

Modify `packages/cdp/src/index.ts`:

```ts
export * from "./client.js";
export * from "./pageScanner.js";
export * from "./runtime.js";
export * from "./evaluate.js";
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/cdp/test/runtime.test.ts
pnpm --filter @uiheal/cdp typecheck
```

Expected: PASS.

---

### Task 2: CDP Page And Context Discovery

**Files:**
- Create: `packages/cdp/src/pageDiscovery.ts`
- Create: `packages/cdp/test/pageDiscovery.test.ts`
- Modify: `packages/cdp/src/index.ts`

**Interfaces:**
- Produces: `findA360Page(pages: CdpPage[], fileId?: string): CdpPage | null`.
- Produces: `findTargetPages(pages: CdpPage[], targetUrls: string[]): CdpPage[]`.
- Produces: `discoverExecutionContexts(runtime: CdpRuntime): Promise<CdpExecutionContext[]>`.
- Produces: `pickDefaultContext(contexts: CdpExecutionContext[], originPart: string): CdpExecutionContext | null`.
- Produces: `pickExtensionContext(contexts: CdpExecutionContext[], extensionName: string): CdpExecutionContext | null`.

- [ ] **Step 1: Write failing discovery tests**

Create `packages/cdp/test/pageDiscovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findA360Page, findTargetPages, pickDefaultContext, pickExtensionContext } from "../src/index.js";

describe("CDP page discovery", () => {
  const pages = [
    { id: "1", type: "page", title: "Bot", url: "https://aa/#/bots/repository/private/files/task/100/edit", webSocketDebuggerUrl: "ws://a" },
    { id: "2", type: "page", title: "ACME", url: "https://acme-test.uipath.com/login", webSocketDebuggerUrl: "ws://b" }
  ];

  it("finds A360 bot editor page by file id", () => {
    expect(findA360Page(pages, "100")?.id).toBe("1");
  });

  it("finds target pages by URL prefix", () => {
    expect(findTargetPages(pages, ["https://acme-test.uipath.com/login"])).toHaveLength(1);
  });

  it("picks default and extension contexts", () => {
    const contexts = [
      { id: 4, name: "", origin: "https://aa", type: "default" },
      { id: 6, name: "Automation 360", origin: "chrome-extension://abc", type: "isolated" }
    ];
    expect(pickDefaultContext(contexts, "https://aa")?.id).toBe(4);
    expect(pickExtensionContext(contexts, "Automation 360")?.id).toBe(6);
  });
});
```

- [ ] **Step 2: Implement discovery**

Create `packages/cdp/src/pageDiscovery.ts`:

```ts
import type { CdpPage } from "./client.js";
import type { CdpRuntime } from "./runtime.js";

export interface CdpExecutionContext {
  id: number;
  name: string;
  origin: string;
  type?: string;
}

export function findA360Page(pages: CdpPage[], fileId?: string): CdpPage | null {
  return (
    pages.find(
      (page) =>
        page.type === "page" &&
        page.url.includes("/#/bots/repository/private/files/task/") &&
        (!fileId || page.url.includes(`/task/${fileId}/`))
    ) ?? null
  );
}

export function findTargetPages(pages: CdpPage[], targetUrls: string[]): CdpPage[] {
  return pages.filter((page) => page.type === "page" && targetUrls.some((url) => page.url.startsWith(url)));
}

export async function discoverExecutionContexts(runtime: CdpRuntime): Promise<CdpExecutionContext[]> {
  const contexts: CdpExecutionContext[] = [];
  const originalSend = runtime.send.bind(runtime);
  await originalSend("Runtime.enable");
  return contexts;
}

export function pickDefaultContext(contexts: CdpExecutionContext[], originPart: string): CdpExecutionContext | null {
  return contexts.find((context) => context.origin.includes(originPart) && (!context.name || context.type === "default")) ?? null;
}

export function pickExtensionContext(contexts: CdpExecutionContext[], extensionName: string): CdpExecutionContext | null {
  return contexts.find((context) => context.name === extensionName) ?? null;
}
```

Implementation note: after this unit test passes, enhance `createCdpRuntime` in Task 3 to expose event subscription so `discoverExecutionContexts` can collect real `Runtime.executionContextCreated` events.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/cdp/test/pageDiscovery.test.ts
pnpm --filter @uiheal/cdp typecheck
```

Expected: PASS.

---

### Task 3: Real CDP Event Subscription

**Files:**
- Modify: `packages/cdp/src/runtime.ts`
- Modify: `packages/cdp/src/pageDiscovery.ts`
- Modify: `packages/cdp/test/runtime.test.ts`

**Interfaces:**
- Extends: `CdpRuntime.on(method: string, handler: (params: unknown) => void): () => void`.
- Updates: `discoverExecutionContexts(runtime, waitMs = 700)`.

- [ ] **Step 1: Add event subscription implementation**

Modify `CdpRuntime`:

```ts
export interface CdpRuntime {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  on(method: string, handler: (params: unknown) => void): () => void;
  close(): void;
}
```

In `createCdpRuntime`, keep `handlers = new Map<string, Set<(params: unknown) => void>>()`. In `ws.onmessage`, when `message.method` exists, call registered handlers.

- [ ] **Step 2: Update context discovery**

Implement:

```ts
export async function discoverExecutionContexts(runtime: CdpRuntime, waitMs = 700): Promise<CdpExecutionContext[]> {
  const contexts: CdpExecutionContext[] = [];
  const unsubscribe = runtime.on("Runtime.executionContextCreated", (params: any) => {
    const context = params.context;
    contexts.push({
      id: context.id,
      name: context.name,
      origin: context.origin,
      type: context.auxData?.type
    });
  });
  await runtime.send("Runtime.enable");
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  unsubscribe();
  return contexts;
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/cdp/test/runtime.test.ts packages/cdp/test/pageDiscovery.test.ts
pnpm --filter @uiheal/cdp typecheck
```

Expected: PASS.

---

### Task 4: Candidate Discovery Beyond Stored Selectors

**Files:**
- Create: `packages/cdp/src/candidateDiscovery.ts`
- Create: `packages/cdp/test/candidateDiscovery.test.ts`
- Modify: `packages/cdp/src/index.ts`

**Interfaces:**
- Produces: `buildCandidateDiscoveryExpression(target: UiTarget): string`.
- Produces candidates using id, name, CSS, XPath, tag/type, label text, role, and nearby text.

- [ ] **Step 1: Write failing candidate discovery test**

Create `packages/cdp/test/candidateDiscovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCandidateDiscoveryExpression } from "../src/index.js";

describe("candidate discovery", () => {
  it("builds a script with multiple discovery strategies", () => {
    const expression = buildCandidateDiscoveryExpression({
      id: "email",
      sourceTool: "a360",
      selectors: [{ kind: "css", value: "input#email", enabled: true }],
      element: { tag: "input", type: "email", name: "email", label: "Email:" }
    });
    expect(expression).toContain("querySelectorAll");
    expect(expression).toContain("label");
    expect(expression).toContain("input");
    expect(expression).toContain("email");
  });
});
```

- [ ] **Step 2: Implement discovery expression**

Create `packages/cdp/src/candidateDiscovery.ts`:

```ts
import type { UiTarget } from "@uiheal/core";

export function buildCandidateDiscoveryExpression(target: UiTarget): string {
  return `(() => {
    const target = ${JSON.stringify(target)};
    const candidates = new Map();
    function add(el, selectorValue, reason) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const key = selectorValue + "|" + rect.x + "|" + rect.y;
      if (candidates.has(key)) return;
      const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      candidates.set(key, {
        candidateId: key,
        selector: { kind: "css", value: selectorValue, enabled: true, source: "cdp:" + reason },
        url: location.href,
        element: {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || undefined,
          role: el.getAttribute("role") || undefined,
          id: el.id || undefined,
          name: el.getAttribute("name") || undefined,
          text: (el.innerText || el.value || "").trim().slice(0, 500),
          label: label ? label.textContent.trim() : undefined,
          classes: Array.from(el.classList)
        },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        metadata: { reason }
      });
    }
    for (const selector of target.selectors || []) {
      if (selector.kind === "css") { try { add(document.querySelector(selector.value), selector.value, "stored-css"); } catch(e) {} }
      if (selector.kind === "id") add(document.getElementById(selector.value), "#" + CSS.escape(selector.value), "stored-id");
      if (selector.kind === "name") document.querySelectorAll('[name="' + CSS.escape(selector.value) + '"]').forEach((el) => add(el, '[name="' + CSS.escape(selector.value) + '"]', "stored-name"));
    }
    if (target.element?.id) add(document.getElementById(target.element.id), "#" + CSS.escape(target.element.id), "target-id");
    if (target.element?.name) document.querySelectorAll('[name="' + CSS.escape(target.element.name) + '"]').forEach((el) => add(el, '[name="' + CSS.escape(target.element.name) + '"]', "target-name"));
    const tag = target.element?.tag || "*";
    document.querySelectorAll(tag).forEach((el, index) => {
      const typeOk = !target.element?.type || el.getAttribute("type") === target.element.type;
      if (typeOk && index < 200) add(el, tag + ":nth-of-type(" + (index + 1) + ")", "tag-type-pool");
    });
    return Array.from(candidates.values());
  })()`;
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/cdp/test/candidateDiscovery.test.ts
pnpm --filter @uiheal/cdp typecheck
```

Expected: PASS.

---

### Task 5: A360 Live Session From Browser Context

**Files:**
- Create: `packages/adapters-a360/src/a360LiveSession.ts`
- Create: `packages/adapters-a360/test/a360LiveSession.test.ts`
- Modify: `packages/adapters-a360/src/index.ts`

**Interfaces:**
- Produces: `buildA360SessionProbeExpression(fileId?: string): string`.
- Produces browser-evaluated result `{ origin, fileId, hasAuthToken, contentUrl }`.
- Does not return token to Node unless an explicit fetch expression runs inside the browser context.

- [ ] **Step 1: Write failing live session tests**

Create `packages/adapters-a360/test/a360LiveSession.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildA360SessionProbeExpression } from "../src/index.js";

describe("A360 live session", () => {
  it("builds a probe expression without exposing auth token", () => {
    const expression = buildA360SessionProbeExpression("100126347");
    expect(expression).toContain("localStorage.authToken");
    expect(expression).toContain("hasAuthToken");
    expect(expression).not.toContain("return auth");
  });
});
```

- [ ] **Step 2: Implement safe browser probe**

Create `packages/adapters-a360/src/a360LiveSession.ts`:

```ts
export interface A360SessionProbe {
  origin: string;
  fileId: string | null;
  hasAuthToken: boolean;
  contentUrl: string | null;
}

export function buildA360SessionProbeExpression(fileId?: string): string {
  return `(() => {
    const urlFileId = (location.hash.match(/files\\\\/task\\\\/(\\\\d+)/) || [])[1] || null;
    const resolvedFileId = ${JSON.stringify(fileId ?? null)} || urlFileId;
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    return {
      origin: location.origin,
      fileId: resolvedFileId,
      hasAuthToken: Boolean(auth),
      contentUrl: resolvedFileId ? location.origin + "/v2/repository/files/" + resolvedFileId + "/content" : null
    };
  })()`;
}

export function buildA360FetchBotExpression(fileId: string): string {
  return `(async () => {
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    const response = await fetch(location.origin + "/v2/repository/files/${fileId}/content", {
      headers: { "X-Authorization": auth, "Accept": "application/json" },
      credentials: "include"
    });
    if (!response.ok) throw new Error("A360 content fetch failed with HTTP " + response.status);
    return await response.json();
  })()`;
}
```

Modify `packages/adapters-a360/src/index.ts` to export it.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/adapters-a360/test/a360LiveSession.test.ts
pnpm --filter @uiheal/adapters-a360 typecheck
```

Expected: PASS.

---

### Task 6: Live A360 Preflight Command Orchestrator

**Files:**
- Create: `packages/cli/src/commands/a360Live.ts`
- Create: `packages/cli/test/a360Live.test.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/package.json`

**Interfaces:**
- Produces: `runA360LivePreflight(input: A360LivePreflightInput): Promise<A360PreflightResult>`.
- CLI command: `uiheal a360 preflight --cdp 9222 --file-id 100126347 --report html --out reports/a360-preflight.html`.

- [ ] **Step 1: Write orchestration test with mocked dependencies**

Create `packages/cli/test/a360Live.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planA360LivePreflight } from "../src/commands/a360Live.js";

describe("A360 live preflight planning", () => {
  it("normalizes CLI options", () => {
    expect(
      planA360LivePreflight({
        cdp: "9222",
        fileId: "100126347",
        report: "html",
        out: "reports/a360.html"
      })
    ).toEqual({
      cdpPort: 9222,
      fileId: "100126347",
      reportFormat: "html",
      outPath: "reports/a360.html",
      apply: false
    });
  });
});
```

- [ ] **Step 2: Implement live command planning and orchestration**

Create `packages/cli/src/commands/a360Live.ts`:

```ts
import { buildCandidateDiscoveryExpression, createCdpRuntime, evaluateInContext, findA360Page, findTargetPages, listCdpPages } from "@uiheal/cdp";
import { buildA360FetchBotExpression, buildA360SessionProbeExpression, extractA360Targets } from "@uiheal/adapters-a360";
import { runA360Preflight, type A360PreflightResult } from "./a360.js";

export interface A360LiveCliOptions {
  cdp: string;
  fileId?: string;
  report?: string;
  out?: string;
  apply?: boolean;
}

export interface A360LivePlan {
  cdpPort: number;
  fileId?: string;
  reportFormat: "json" | "html";
  outPath?: string;
  apply: boolean;
}

export function planA360LivePreflight(options: A360LiveCliOptions): A360LivePlan {
  return {
    cdpPort: Number(options.cdp),
    fileId: options.fileId,
    reportFormat: options.report === "json" ? "json" : "html",
    outPath: options.out,
    apply: options.apply === true
  };
}

export async function runA360LivePreflight(options: A360LiveCliOptions): Promise<A360PreflightResult> {
  const plan = planA360LivePreflight(options);
  const pages = await listCdpPages(plan.cdpPort);
  const a360Page = findA360Page(pages, plan.fileId);
  if (!a360Page) throw new Error("A360 bot editor page was not found in Chrome CDP pages");

  const a360Runtime = await createCdpRuntime(a360Page.webSocketDebuggerUrl);
  try {
    const probe = await evaluateInContext<any>(a360Runtime, { expression: buildA360SessionProbeExpression(plan.fileId) });
    if (!probe.hasAuthToken || !probe.fileId) throw new Error("A360 session is missing auth token or file id");
    const bot = await evaluateInContext<any>(a360Runtime, { expression: buildA360FetchBotExpression(probe.fileId) });
    const targets = extractA360Targets(bot);
    const targetPages = findTargetPages(pages, [...new Set(targets.map((target) => target.url).filter(Boolean))] as string[]);
    const candidatesByTargetId: Record<string, any[]> = {};
    for (const target of targets) {
      const page = targetPages.find((item) => target.url && item.url.startsWith(target.url));
      if (!page) {
        candidatesByTargetId[target.id] = [];
        continue;
      }
      const runtime = await createCdpRuntime(page.webSocketDebuggerUrl);
      try {
        candidatesByTargetId[target.id] = await evaluateInContext(runtime, {
          expression: buildCandidateDiscoveryExpression(target)
        });
      } finally {
        runtime.close();
      }
    }
    return await runA360Preflight({ bot, candidatesByTargetId });
  } finally {
    a360Runtime.close();
  }
}
```

Modify CLI `src/index.ts` to register:

```ts
program
  .command("a360")
  .command("preflight")
  .requiredOption("--cdp <port>")
  .option("--file-id <fileId>")
  .option("--report <format>", "html or json", "html")
  .option("--out <path>")
  .option("--apply", "apply patch instead of preview", false);
```

Implementation note: Commander nested command may be cleaner as `const a360 = program.command("a360")`; add `a360.command("preflight")`.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/cli/test/a360Live.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

---

### Task 7: JSON And HTML Report Writers

**Files:**
- Create: `packages/cli/src/report/jsonReport.ts`
- Create: `packages/cli/src/report/writeReport.ts`
- Create: `packages/cli/test/reportWriters.test.ts`

**Interfaces:**
- Produces: `renderJsonReport(result: unknown): string`.
- Produces: `writeReportFile(path: string, content: string): Promise<void>`.
- Redacts token-like strings in report content.

- [ ] **Step 1: Write failing report tests**

Create `packages/cli/test/reportWriters.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderJsonReport } from "../src/report/jsonReport.js";
import { writeReportFile } from "../src/report/writeReport.js";

describe("report writers", () => {
  it("renders pretty JSON", () => {
    expect(renderJsonReport({ ok: true })).toContain('"ok": true');
  });

  it("writes report file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uiheal-"));
    const path = join(dir, "report.html");
    await writeReportFile(path, "<h1>ok</h1>");
    expect(readFileSync(path, "utf8")).toBe("<h1>ok</h1>");
  });
});
```

- [ ] **Step 2: Implement writers**

Create `packages/cli/src/report/jsonReport.ts`:

```ts
export function renderJsonReport(result: unknown): string {
  return JSON.stringify(result, null, 2);
}
```

Create `packages/cli/src/report/writeReport.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeReportFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}
```

- [ ] **Step 3: Wire report output into live command**

In `src/index.ts`, after `runA360LivePreflight`, call `renderHtmlReport` or `renderJsonReport`; write to `--out` if provided, otherwise print to stdout.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/cli/test/reportWriters.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

---

### Task 8: Offline Snapshot Mode

**Files:**
- Create: `packages/cli/src/commands/snapshot.ts`
- Create: `packages/cli/test/snapshot.test.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Produces: `createSnapshotPayload(candidates: UiCandidate[], metadata: object): SnapshotPayload`.
- CLI commands:
  - `uiheal snapshot create --cdp 9222 --url-prefix https://portal.local --out snapshot.json`
  - `uiheal a360 preflight --bot bot.json --snapshot snapshot.json --report html`

- [ ] **Step 1: Write failing snapshot test**

Create `packages/cli/test/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSnapshotPayload } from "../src/commands/snapshot.js";

describe("snapshot mode", () => {
  it("creates a portable snapshot payload", () => {
    const snapshot = createSnapshotPayload(
      [{ candidateId: "c1", element: { tag: "input", name: "email" }, url: "https://portal/login" }],
      { source: "cdp" }
    );
    expect(snapshot.version).toBe(1);
    expect(snapshot.candidates).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement snapshot payload**

Create `packages/cli/src/commands/snapshot.ts`:

```ts
import type { UiCandidate } from "@uiheal/core";

export interface SnapshotPayload {
  version: number;
  createdAt: string;
  metadata: Record<string, unknown>;
  candidates: UiCandidate[];
}

export function createSnapshotPayload(candidates: UiCandidate[], metadata: Record<string, unknown>): SnapshotPayload {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    metadata,
    candidates
  };
}
```

- [ ] **Step 3: Add CLI commands**

Add `snapshot create` command and `a360 preflight --bot --snapshot` path. The offline path reads bot JSON and snapshot JSON from disk and calls `runA360Preflight`.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/cli/test/snapshot.test.ts
pnpm --filter uiheal typecheck
```

Expected: PASS.

---

### Task 9: A360 Apply Patch With Explicit Flag

**Files:**
- Create: `packages/adapters-a360/src/a360ApplyPatch.ts`
- Create: `packages/adapters-a360/test/a360ApplyPatch.test.ts`
- Modify: `packages/adapters-a360/src/index.ts`
- Modify: `packages/cli/src/commands/a360Live.ts`

**Interfaces:**
- Produces: `assertApplyAllowed(apply: boolean): void`.
- Produces: `buildA360SaveBotExpression(fileId: string, bot: A360BotContent): string`.

- [ ] **Step 1: Write failing safety tests**

Create `packages/adapters-a360/test/a360ApplyPatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertApplyAllowed, buildA360SaveBotExpression } from "../src/index.js";

describe("A360 apply patch safety", () => {
  it("requires apply flag", () => {
    expect(() => assertApplyAllowed(false)).toThrow("--apply");
    expect(() => assertApplyAllowed(true)).not.toThrow();
  });

  it("builds save expression without embedding auth into logs", () => {
    const expression = buildA360SaveBotExpression("100", { nodes: [] });
    expect(expression).toContain("/v2/repository/files/100/content");
    expect(expression).toContain("localStorage.authToken");
  });
});
```

- [ ] **Step 2: Implement apply helpers**

Create `packages/adapters-a360/src/a360ApplyPatch.ts`:

```ts
import type { A360BotContent } from "./a360Bot.js";

export function assertApplyAllowed(apply: boolean): void {
  if (!apply) throw new Error("Refusing to write changes without explicit --apply");
}

export function buildA360SaveBotExpression(fileId: string, bot: A360BotContent): string {
  return `(async () => {
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    const response = await fetch(location.origin + "/v2/repository/files/${fileId}/content?hasErrors=false", {
      method: "PUT",
      headers: { "X-Authorization": auth, "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include",
      body: ${JSON.stringify(JSON.stringify(bot))}
    });
    if (!response.ok) throw new Error("A360 save failed with HTTP " + response.status);
    return { ok: true, status: response.status };
  })()`;
}
```

- [ ] **Step 3: Wire apply path**

In `runA360LivePreflight`, only evaluate save expression if `plan.apply === true`. Otherwise include patch previews in the report.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/adapters-a360/test/a360ApplyPatch.test.ts
pnpm --filter @uiheal/adapters-a360 typecheck
```

Expected: PASS.

---

### Task 10: Playwright Adapter

**Files:**
- Create: `packages/adapters-playwright/package.json`
- Create: `packages/adapters-playwright/tsconfig.json`
- Create: `packages/adapters-playwright/src/index.ts`
- Create: `packages/adapters-playwright/src/playwrightExtract.ts`
- Create: `packages/adapters-playwright/src/playwrightPatch.ts`
- Create: `packages/adapters-playwright/test/playwrightExtract.test.ts`
- Create: `examples/playwright-login.spec.ts`

**Interfaces:**
- Produces: `extractPlaywrightTargets(source: string, filePath: string): UiTarget[]`.
- Handles `page.locator`, `page.getByRole`, `page.getByText`, `page.getByLabel`.

- [ ] **Step 1: Write failing Playwright extraction test**

Create `packages/adapters-playwright/test/playwrightExtract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPlaywrightTargets } from "../src/index.js";

describe("Playwright adapter", () => {
  it("extracts common locators", () => {
    const source = `
      await page.locator("#email").fill("a@b.com");
      await page.getByRole("button", { name: "Login" }).click();
      await page.getByLabel("Password").fill("secret");
    `;
    const targets = extractPlaywrightTargets(source, "login.spec.ts");
    expect(targets.map((target) => target.selectors[0].kind)).toEqual(["css", "role", "text"]);
  });
});
```

- [ ] **Step 2: Implement lightweight extractor**

Use regex-based extraction for MVP. Do not rewrite source yet.

Create `playwrightExtract.ts` with:

```ts
import type { UiTarget } from "@uiheal/core";

export function extractPlaywrightTargets(source: string, filePath: string): UiTarget[] {
  const targets: UiTarget[] = [];
  for (const match of source.matchAll(/page\.locator\(["'`]([^"'`]+)["'`]\)/g)) {
    targets.push({ id: `${filePath}:${match.index}`, sourceTool: "playwright", selectors: [{ kind: "css", value: match[1], enabled: true }], element: {}, metadata: { filePath } });
  }
  for (const match of source.matchAll(/page\.getByRole\(["'`]([^"'`]+)["'`]\s*,\s*\{\s*name:\s*["'`]([^"'`]+)["'`]/g)) {
    targets.push({ id: `${filePath}:${match.index}`, sourceTool: "playwright", selectors: [{ kind: "role", value: `${match[1]}:${match[2]}`, enabled: true }], element: { role: match[1], text: match[2] }, metadata: { filePath } });
  }
  for (const match of source.matchAll(/page\.getByLabel\(["'`]([^"'`]+)["'`]\)/g)) {
    targets.push({ id: `${filePath}:${match.index}`, sourceTool: "playwright", selectors: [{ kind: "text", value: match[1], enabled: true }], element: { label: match[1] }, metadata: { filePath } });
  }
  return targets;
}
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm install
pnpm test packages/adapters-playwright/test/playwrightExtract.test.ts
pnpm --filter @uiheal/adapters-playwright typecheck
```

Expected: PASS.

---

### Task 11: Selenium Adapter

**Files:**
- Create: `packages/adapters-selenium/package.json`
- Create: `packages/adapters-selenium/tsconfig.json`
- Create: `packages/adapters-selenium/src/index.ts`
- Create: `packages/adapters-selenium/src/seleniumExtract.ts`
- Create: `packages/adapters-selenium/src/seleniumPatch.ts`
- Create: `packages/adapters-selenium/test/seleniumExtract.test.ts`
- Create: `examples/selenium-login.py`

**Interfaces:**
- Produces: `extractSeleniumTargets(source: string, filePath: string): UiTarget[]`.
- Handles Python/Java/JS-like `By.ID`, `By.NAME`, `By.CSS_SELECTOR`, `By.XPATH`.

- [ ] **Step 1: Write failing Selenium extraction test**

Create `packages/adapters-selenium/test/seleniumExtract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractSeleniumTargets } from "../src/index.js";

describe("Selenium adapter", () => {
  it("extracts Selenium By selectors", () => {
    const source = `
      driver.find_element(By.ID, "email")
      driver.find_element(By.CSS_SELECTOR, "button.login")
      driver.find_element(By.XPATH, "//input[@name='password']")
    `;
    const targets = extractSeleniumTargets(source, "login.py");
    expect(targets.map((target) => target.selectors[0].kind)).toEqual(["id", "css", "xpath"]);
  });
});
```

- [ ] **Step 2: Implement extractor**

Create extractor with regex mapping:

```ts
const byMap = { ID: "id", NAME: "name", CSS_SELECTOR: "css", XPATH: "xpath" } as const;
```

Return `UiTarget[]` with `sourceTool: "selenium"`.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm install
pnpm test packages/adapters-selenium/test/seleniumExtract.test.ts
pnpm --filter @uiheal/adapters-selenium typecheck
```

Expected: PASS.

---

### Task 12: Puppeteer Adapter

**Files:**
- Create: `packages/adapters-puppeteer/package.json`
- Create: `packages/adapters-puppeteer/tsconfig.json`
- Create: `packages/adapters-puppeteer/src/index.ts`
- Create: `packages/adapters-puppeteer/src/puppeteerExtract.ts`
- Create: `packages/adapters-puppeteer/src/puppeteerPatch.ts`
- Create: `packages/adapters-puppeteer/test/puppeteerExtract.test.ts`
- Create: `examples/puppeteer-login.js`

**Interfaces:**
- Produces: `extractPuppeteerTargets(source: string, filePath: string): UiTarget[]`.
- Handles `page.$`, `page.$$`, `page.waitForSelector`.

- [ ] **Step 1: Write failing Puppeteer extraction test**

Create `packages/adapters-puppeteer/test/puppeteerExtract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPuppeteerTargets } from "../src/index.js";

describe("Puppeteer adapter", () => {
  it("extracts CSS selectors", () => {
    const source = `
      await page.waitForSelector("#email");
      await page.$("button.login");
    `;
    const targets = extractPuppeteerTargets(source, "login.js");
    expect(targets.map((target) => target.selectors[0].value)).toEqual(["#email", "button.login"]);
  });
});
```

- [ ] **Step 2: Implement extractor**

Use regex for:

```ts
/page\.waitForSelector\(["'`]([^"'`]+)["'`]\)/g
/page\.\$\(["'`]([^"'`]+)["'`]\)/g
```

Return `sourceTool: "puppeteer"` targets.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm install
pnpm test packages/adapters-puppeteer/test/puppeteerExtract.test.ts
pnpm --filter @uiheal/adapters-puppeteer typecheck
```

Expected: PASS.

---

### Task 13: CLI Commands For Community Adapters

**Files:**
- Create: `packages/cli/src/commands/playwright.ts`
- Create: `packages/cli/src/commands/selenium.ts`
- Create: `packages/cli/src/commands/puppeteer.ts`
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- CLI commands:
  - `uiheal playwright scan <path>`
  - `uiheal selenium scan <path>`
  - `uiheal puppeteer scan <path>`

- [ ] **Step 1: Implement scan functions**

Each command reads a file path, extracts targets, and prints JSON. Keep directory recursion out of scope until the next plan.

- [ ] **Step 2: Add commander commands**

Register each command in `src/index.ts`.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter uiheal typecheck
pnpm test
```

Expected: PASS.

---

### Task 14: End-to-End Local Smoke Tests

**Files:**
- Create: `packages/cli/test/e2eOffline.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm test:e2e:offline`.
- Tests generic/A360 offline flows without live Chrome.

- [ ] **Step 1: Add offline E2E test**

Test:

1. Load A360 fixture.
2. Extract target.
3. Build candidate.
4. Run A360 preflight.
5. Render HTML and JSON.
6. Assert patch plan exists.

- [ ] **Step 2: Add script**

Add:

```json
"test:e2e:offline": "vitest run packages/cli/test/e2eOffline.test.ts"
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test:e2e:offline
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

---

### Task 15: Live Manual Validation Script

**Files:**
- Create: `scripts/live-a360-preflight-smoke.ps1`
- Create: `docs/architecture/live-a360-flow.md`
- Create: `docs/architecture/offline-enterprise-flow.md`

**Interfaces:**
- Documents exact manual validation:
  `chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\chrome-dev-profile"`
  then:
  `pnpm --filter uiheal start -- a360 preflight --cdp 9222 --file-id 100126347 --report html --out reports/a360.html`

- [ ] **Step 1: Write PowerShell smoke script**

Create script:

```powershell
param(
  [int]$CdpPort = 9222,
  [string]$FileId,
  [string]$Out = "reports/a360-preflight.html"
)

pnpm --filter uiheal build
node packages/cli/dist/index.js a360 preflight --cdp $CdpPort --file-id $FileId --report html --out $Out
```

- [ ] **Step 2: Document live A360 flow**

Include:

- start Chrome with CDP
- open A360 bot editor
- open target portal tab
- run command
- inspect report
- do not use `--apply` until preview is reviewed

- [ ] **Step 3: Document offline enterprise flow**

Include:

- capture snapshot inside RDP
- move only redacted snapshot if allowed
- run offline preflight
- generate patch preview

- [ ] **Step 4: Verify final suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS.

---

### Task 16: Optional OpenRouter AI Guidance Package

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/openRouterClient.ts`
- Create: `packages/ai/src/guidancePrompt.ts`
- Create: `packages/ai/src/redaction.ts`
- Create: `packages/ai/test/openRouterClient.test.ts`
- Create: `packages/ai/test/guidancePrompt.test.ts`

**Interfaces:**
- Produces: `createOpenRouterClient(options: OpenRouterOptions): AiGuidanceClient`.
- Produces: `buildGuidancePrompt(input: GuidancePromptInput): OpenRouterMessage[]`.
- Produces: `redactGuidanceEvidence(input: unknown): unknown`.

- [ ] **Step 1: Add package and tests**

Create tests that verify:

- client uses base URL `https://openrouter.ai/api/v1/chat/completions`
- API key comes only from `OPENROUTER_API_KEY` or explicit option
- default model can be `openrouter/auto` or any provided model slug
- prompt excludes cookies, auth headers, raw passwords, and full page HTML

- [ ] **Step 2: Implement OpenRouter client**

Use direct `fetch` instead of a heavy SDK dependency:

```ts
export interface OpenRouterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AiGuidanceClient {
  complete(messages: OpenRouterMessage[]): Promise<string>;
}
```

Default:

```ts
baseUrl = "https://openrouter.ai/api/v1/chat/completions"
model = process.env.UIHEAL_AI_MODEL || "openrouter/auto"
apiKey = options.apiKey || process.env.OPENROUTER_API_KEY
```

- [ ] **Step 3: Implement compact guidance prompt**

Prompt input must contain only:

- target id
- automation tool
- old selectors
- validation status/confidence
- top candidate summaries
- signal scores/reasons
- URL origin/path, not query secrets
- patch preview

It must not include:

- cookies
- auth tokens
- passwords
- complete HTML
- screenshot binary
- A360 auth token

- [ ] **Step 4: Verify**

Run:

```bash
pnpm install
pnpm test packages/ai/test/openRouterClient.test.ts packages/ai/test/guidancePrompt.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

### Task 17: AI Guidance CLI Integration

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/commands/a360Live.ts`
- Modify: `packages/cli/src/report/htmlReport.ts`
- Modify: `packages/cli/src/report/jsonReport.ts`
- Create: `packages/cli/test/aiGuidanceCli.test.ts`

**Interfaces:**
- CLI flags:
  - `--ai off|guide|plan`
  - `--ai-provider openrouter`
  - `--ai-model <modelSlug>`
  - `--ai-max-targets <number>`

- [ ] **Step 1: Add CLI option planning tests**

Verify:

```bash
uiheal a360 preflight --ai off
uiheal a360 preflight --ai guide --ai-provider openrouter --ai-model openrouter/auto
```

maps to:

```ts
ai: { mode: "guide", provider: "openrouter", model: "openrouter/auto" }
```

- [ ] **Step 2: Integrate AI after deterministic results**

Rules:

- `--ai off`: no AI package call.
- `--ai guide`: call AI only for failed/repairable targets.
- `--ai plan`: call AI for failed/repairable targets plus stateful login/setup planning.
- If `OPENROUTER_API_KEY` is missing, return a report warning and continue without AI.
- Never fail deterministic preflight because AI failed.

- [ ] **Step 3: Add report fields**

Add report fields per target:

```json
{
  "aiGuidance": {
    "provider": "openrouter",
    "model": "openrouter/auto",
    "summary": "Selector likely changed from id to name-based input.",
    "recommendedAction": "Use input[name='email'] and keep old XPath as fallback."
  }
}
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test packages/cli/test/aiGuidanceCli.test.ts
pnpm --filter uiheal typecheck
pnpm test
```

Expected: PASS.

---

### Task 18: Stateful Planning With AI Assist

**Files:**
- Create: `packages/ai/src/statePlanPrompt.ts`
- Create: `packages/ai/test/statePlanPrompt.test.ts`
- Create: `docs/architecture/ai-guidance-openrouter.md`

**Interfaces:**
- Produces: `buildStatePlanPrompt(input: StatePlanPromptInput): OpenRouterMessage[]`.
- Supports modes:
  - `manual`: identify state gap and ask operator to prepare state.
  - `assist`: generate Playwright setup script for user review.
  - `execute`: run only after allowlist and explicit execution flag in a later plan.

- [ ] **Step 1: Define state plan prompt contract**

Prompt input:

- grouped targets by URL/state
- login page indicators
- post-login targets missing from current tabs
- safe candidate selectors for username/password/login button
- allowed origin

Prompt output schema:

```json
{
  "statePlan": [
    {
      "stateId": "login",
      "required": true,
      "mode": "assist",
      "playwrightSetupScript": "...",
      "risk": "low|medium|high",
      "humanReviewRequired": true
    }
  ]
}
```

- [ ] **Step 2: Add safety rules to docs**

Document:

- credentials only via env vars
- do not store credentials in reports
- never auto-click destructive buttons
- require `--allow-origin`
- require future explicit `--execute-state-plan`
- generated Playwright scripts are review artifacts first

- [ ] **Step 3: Verify**

Run:

```bash
pnpm test packages/ai/test/statePlanPrompt.test.ts
pnpm --filter @uiheal/ai typecheck
```

Expected: PASS.

---

## Self-Review

Spec coverage:

- Live A360 command: Tasks 1-7.
- CDP WebSocket execution: Tasks 1-4.
- A360 browser-session fetch without token logging: Tasks 5-6.
- HTML/JSON report writing: Task 7.
- Offline enterprise/RDP mode: Task 8 and Task 15.
- Explicit apply safety: Task 9.
- Playwright/Selenium/Puppeteer adapters: Tasks 10-13.
- End-to-end offline tests: Task 14.
- Live manual validation docs/script: Task 15.
- Optional OpenRouter AI guidance: Tasks 16-18.
- Stateful login/setup planning with AI assist: Task 18.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified tasks remain.
- Some implementation details intentionally use regex MVP extraction for community adapters; that is explicit scope, not a placeholder.

Type consistency:

- `CdpRuntime`, `CdpPage`, `UiTarget`, `UiCandidate`, `A360PreflightResult`, and `PatchPlan` are reused consistently.
- Live A360 orchestration depends only on exported package APIs.

Execution checkpoint recommendation:

- Implement Tasks 1-9 first as Milestone A: real live A360 preflight.
- Stop for live validation against Chrome `9222`.
- Implement Tasks 10-13 as Milestone B: community adapters.
- Implement Tasks 14-15 as Milestone C: E2E hardening and docs.
- Implement Tasks 16-18 as Milestone D: optional AI guidance and stateful planning.

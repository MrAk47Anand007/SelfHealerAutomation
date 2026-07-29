# UIHeal / SelfHealerAutomation

Local-first enterprise UI automation preflight and self-healing toolkit for Automation Anywhere A360, Playwright, Selenium, Puppeteer, and generic UI target catalogs.

UIHeal is designed for portals that change frequently. Before a bot or test runs, UIHeal can scan the current website, compare the recorded selectors and UI context against live elements, identify drift, suggest repairs, optionally ask AI for guidance, and produce auditable JSON/HTML evidence.

The first deep implementation is A360 because A360 Recorder stores rich `UIOBJECT` metadata. The architecture is intentionally adapter-based so the same engine can support Playwright, Selenium, and Puppeteer flows.

## What It Does

- Extracts UI targets from A360 Recorder bot JSON/UIOBJECTs.
- Decodes A360 UIOBJECT blobs into safe metadata summaries.
- Scans live browser pages through Chrome CDP.
- Handles login-dependent pages through Playwright storage state.
- Produces a universal `UIHealRun` artifact across tools.
- Scores target/candidate confidence deterministically.
- Creates policy-gated patch and rerun evidence.
- Supports optional OpenRouter AI guidance after deterministic evidence.
- Runs locally for RDP/network-restricted enterprise environments.

## Architecture

```text
adapters      A360, Playwright, Selenium, Puppeteer, generic JSON
scanner       CDP scan, Playwright stateful scan, offline snapshot scan
core          selector matching, confidence scoring, repair suggestions
state         login detection, selector inference, storage-state execution
policy        origin/tool/operation/confidence gates and secret redaction
ai            optional OpenRouter guidance
cli           analyze, plan, preflight, heal-rerun, reports
artifacts     universal UIHealRun JSON schema
```

## Repository Layout

```text
packages/artifacts          Universal UIHealRun types, schemas, policy helpers
packages/core               Shared target, candidate, validation, repair logic
packages/cdp                Chrome DevTools scanning/runtime helpers
packages/adapters-a360      A360 bot extraction, blob handling, patch helpers
packages/adapters-playwright
packages/adapters-selenium
packages/adapters-puppeteer
packages/adapters-json
packages/state-planner      Login/state planning and selector inference
packages/ai                 OpenRouter prompt/client/redaction logic
packages/cli                Public CLI commands and report rendering
examples                    Offline fixtures and sample tool inputs
reports                     Local generated reports, ignored by git
backups                     Local backup/patch evidence, ignored by git
```

## Requirements

- Windows PowerShell
- Node.js with Corepack
- Chrome for live A360/CDP runs
- Optional: OpenRouter API key for AI guidance

Do not use `npm install` in this repo. It uses pnpm workspaces.

## Setup

```powershell
cd "C:\Users\Anand\OneDrive - Xalta Technology Services Pvt Ltd\Desktop\SelfProjects\SelfHealerAutomation"
corepack prepare pnpm@9.0.0 --activate
corepack pnpm install
corepack pnpm build
```

If `corepack enable` fails with `EPERM` under `C:\Program Files\nodejs`, skip it. Use `corepack pnpm ...` from the project folder instead.

## Verify

```powershell
corepack pnpm verify
```

This runs:

- unit and integration tests
- TypeScript typecheck
- workspace build

Offline smoke test:

```powershell
corepack pnpm test:e2e:offline
```

## CLI Entry Point

During local development, use:

```powershell
node packages/cli/dist/index.js --help
```

After packaging later, this will become the `uiheal` executable.

## Universal UIHealRun Flow

The universal run artifact is the source of truth for cross-tool compatibility.

```powershell
node packages/cli/dist/index.js analyze `
  --tool generic `
  --targets examples/generic-targets.json `
  --candidates examples/generic-candidates.json `
  --out reports/run.json

node packages/cli/dist/index.js plan `
  --run reports/run.json `
  --report html `
  --out reports/preflight.html

node packages/cli/dist/index.js heal-rerun `
  --run reports/run.json `
  --policy uiheal.config.example.json `
  --allow-origin https://acme-test.uipath.com `
  --backup-dir backups `
  --out reports/healed-run.json
```

Phase 1 `heal-rerun` creates backup/audit evidence, patch previews, and rerun comparison. It does not execute the full business workflow yet.

## Tool-Specific Preflight

```powershell
node packages/cli/dist/index.js playwright preflight `
  --file examples/playwright-login.spec.ts `
  --mode analyze `
  --out reports/playwright-run.json

node packages/cli/dist/index.js selenium preflight `
  --file examples/selenium-login.py `
  --mode analyze `
  --out reports/selenium-run.json

node packages/cli/dist/index.js puppeteer preflight `
  --file examples/puppeteer-login.js `
  --mode analyze `
  --out reports/puppeteer-run.json
```

## A360 Live Preflight

Start Chrome with remote debugging:

```powershell
cd "C:\Program Files\Google\Chrome\Application"
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\chrome-dev-profile"
```

In that Chrome profile:

1. Log in to A360 Control Room.
2. Open the target bot editor.
3. Confirm the URL contains the bot `fileId`.

Run preflight:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --report html `
  --out reports/a360-preflight.html
```

Open the report:

```powershell
start reports/a360-preflight.html
```

Replace `100126347` with your real A360 bot file id.

## Stateful Login Execution

Use this when an A360 bot has both login actions and post-login actions, but only the login page is available in the open browser.

UIHeal will:

1. Extract login and post-login targets from A360 UIOBJECTs.
2. Infer username, password, and submit selectors.
3. Launch Playwright locally.
4. Fill credentials from environment variables.
5. Wait for the portal after open/login/click actions.
6. Probe the protected post-login page.
7. Save Playwright storage state only after authentication is confirmed.
8. Scan the post-login page and produce the report.

Install Playwright Chromium once per machine:

```powershell
node packages/cli/node_modules/playwright/cli.js install chromium
```

Set credentials in the current PowerShell session:

```powershell
$env:UIHEAL_LOGIN_USER="your_login_user"
$env:UIHEAL_LOGIN_PASS="your_login_password"
```

Run the stateful flow:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --stateful execute `
  --execute-state-plan `
  --allow-origin https://acme-test.uipath.com `
  --login-expected-url "**/*" `
  --state-storage reports/uiheal-storage-state.json `
  --report html `
  --out reports/a360-stateful-execute.html
```

Expected success output:

```text
Report written to reports/a360-stateful-execute.html
```

If login fails, UIHeal stops before saving a false storage state:

```text
Login did not authenticate; https://acme-test.uipath.com/work-items redirected back to login.
```

Override inferred selectors only when needed:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --stateful execute `
  --execute-state-plan `
  --allow-origin https://acme-test.uipath.com `
  --login-user-selector "input#email" `
  --login-password-selector "input[type='password']" `
  --login-submit-selector "button[type='submit']" `
  --login-expected-url "**/work-items" `
  --report html `
  --out reports/a360-stateful-execute.html
```

## Stateful Assist Mode

Assist mode generates a reviewable Playwright setup script instead of executing it:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --stateful assist `
  --allow-origin https://acme-test.uipath.com `
  --state-plan-out reports/state-plan.review.playwright.ts
```

## AI Guidance

AI is optional. Deterministic scan and repair logic works with `--ai off`.

Copy the local env template:

```powershell
Copy-Item .env.example .env
notepad .env
```

`.env.example`:

```text
OPENROUTER_API_KEY=
UIHEAL_AI_MODEL=inclusionai/ling-3.0-flash:free
UIHEAL_AI_MAX_TOKENS=700
```

Run with guidance:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --ai guide `
  --report html `
  --out reports/a360-ai-preflight.html
```

Recommended free model:

```text
inclusionai/ling-3.0-flash:free
```

Fallback router:

```text
openrouter/free
```

Only compact, redacted evidence is sent to AI: target identity, failed selectors, candidate summaries, confidence signals, and patch preview. Credentials, auth tokens, and storage state are never sent.

## Policy And Safety

Default policy example:

```json
{
  "allowedTools": ["a360", "playwright", "selenium", "puppeteer", "generic"],
  "allowedOrigins": ["https://acme-test.uipath.com"],
  "minAutoHealConfidence": 0.85,
  "allowDestructiveActions": false,
  "allowApply": true,
  "redactSecrets": true
}
```

Execution safeguards:

- `--stateful execute` requires `--execute-state-plan`.
- Stateful execution requires `--allow-origin`.
- Cross-origin execution is refused.
- Credentials come only from environment variables or future local vault integrations.
- Reports redact credential/session material.
- Storage state, reports, backups, `.env`, `node_modules`, and the A360 extension code folder are ignored by git.

## Current Status

Implemented:

- Universal `UIHealRun` artifact foundation.
- A360 live extraction through Chrome CDP.
- A360 UIOBJECT blob summary extraction.
- Generic, Playwright, Selenium, and Puppeteer adapter entry points.
- Stateful Playwright login execution for A360 flows.
- Authenticated post-login page probe before saving storage state.
- Deterministic confidence scoring and repairable/pass/failed reporting.
- Optional OpenRouter guidance.
- Policy-gated `heal-rerun` artifact flow.

Not yet complete:

- Full ordered business workflow execution.
- Deep patch writing for Playwright/Selenium/Puppeteer.
- Windows Credential Manager vault abstraction.
- Packaged npm CLI and portable Windows/RDP zip.

## Development Notes

Use Corepack commands consistently:

```powershell
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm typecheck
corepack pnpm verify
```

Before committing:

```powershell
git status -sb
corepack pnpm verify
```


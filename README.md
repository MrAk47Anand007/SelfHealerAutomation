# SelfHealerAutomation

Local-first UI automation preflight and healing toolkit for A360, Playwright, Selenium, and Puppeteer flows.

## Setup

This repository uses `pnpm` workspaces. Do not use `npm install`; npm will try to resolve the pnpm workspace layout and can fail with peer-dependency conflicts.

```powershell
cd "C:\Users\Anand\OneDrive - Xalta Technology Services Pvt Ltd\Desktop\SelfProjects\SelfHealerAutomation"
corepack prepare pnpm@9.0.0 --activate
corepack pnpm install
```

If `corepack enable` fails with `EPERM` on Windows, that only means Corepack could not create a global `pnpm` shim under `C:\Program Files\nodejs`. You can still use `corepack pnpm ...` commands from the project folder without admin rights.

## Verify

```powershell
corepack pnpm verify
```

That runs:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Offline CLI Smoke Test

```powershell
pnpm test:e2e:offline
```

## Enterprise UIHeal Run Artifact

The enterprise flow uses a universal `UIHealRun` JSON artifact across A360, Playwright, Selenium, Puppeteer, and generic target catalogs.

```powershell
node packages/cli/dist/index.js analyze --tool generic --targets examples/generic-targets.json --candidates examples/generic-candidates.json --out reports/run.json

node packages/cli/dist/index.js plan --run reports/run.json --report html --out reports/preflight.html

node packages/cli/dist/index.js heal-rerun `
  --run reports/run.json `
  --policy uiheal.config.example.json `
  --allow-origin https://acme-test.uipath.com `
  --backup-dir backups `
  --out reports/healed-run.json
```

Tool-specific shortcuts produce the same run artifact:

```powershell
node packages/cli/dist/index.js playwright preflight --file examples/playwright-login.spec.ts --mode analyze --out reports/playwright-run.json
node packages/cli/dist/index.js selenium preflight --file examples/selenium-login.py --mode analyze --out reports/selenium-run.json
node packages/cli/dist/index.js puppeteer preflight --file examples/puppeteer-login.js --mode analyze --out reports/puppeteer-run.json
```

`heal-rerun` is policy-gated. In this phase it creates backup/audit evidence and a patch preview/rerun comparison, but does not execute full business workflows.

## A360 Live Preflight

Start Chrome with CDP:

```powershell
cd "C:\Program Files\Google\Chrome\Application"
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\chrome-dev-profile"
```

Log in to A360 Control Room and the target website in that Chrome profile, then run:

```powershell
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --report html --out reports/a360-preflight.html
start reports/a360-preflight.html
```

Replace `100126347` with the real A360 bot file id.

## AI Guidance

Option A, PowerShell session only:

```powershell
$env:OPENROUTER_API_KEY="your_key_here"
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai guide --report html --out reports/a360-ai-preflight.html
```

Option B, repeated local testing:

```powershell
Copy-Item .env.example .env
notepad .env
corepack pnpm build
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai guide --report html --out reports/a360-ai-preflight.html
```

Recommended free model: `inclusionai/ling-3.0-flash:free`. In live A360 testing it returned usable selector-repair guidance, while some other free coding models were rate-limited or returned empty output. If that model is rate limited, use `openrouter/free` as a fallback router.

For free models, keep `UIHEAL_AI_MAX_TOKENS` modest, for example `700`, to avoid rate-limit and quota pressure.

Keep `.env` local. It is ignored by git.

## Stateful Login Planning

```powershell
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --stateful assist --allow-origin https://acme-test.uipath.com --state-plan-out reports/state-plan.review.playwright.ts
```

## Stateful Login Execution

Use this when the bot has login-page actions and post-login actions, but only the login page is currently available in CDP. The CLI infers login selectors and post-login URLs from the A360 UIOBJECTs, logs in with Playwright, saves storage state, opens the missing post-login URLs with that state, and scans those pages before producing the final report.

```powershell
$env:UIHEAL_LOGIN_USER="your_login_user"
$env:UIHEAL_LOGIN_PASS="your_login_password"

node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --stateful execute `
  --execute-state-plan `
  --allow-origin https://acme-test.uipath.com `
  --state-storage reports/uiheal-storage-state.json `
  --report html `
  --out reports/a360-stateful-execute.html
```

For first-time Playwright setup on a machine:

```powershell
corepack pnpm exec playwright install chromium
```

If selector inference is wrong, override only that part:

```powershell
node packages/cli/dist/index.js a360 preflight `
  --cdp 9222 `
  --file-id 100126347 `
  --stateful execute `
  --execute-state-plan `
  --allow-origin https://acme-test.uipath.com `
  --login-user-selector "input#email" `
  --login-password-selector "input[type='password']" `
  --login-submit-selector "button.login" `
  --login-expected-url "**/work-items" `
  --report html `
  --out reports/a360-stateful-execute.html
```

The execution mode refuses to run unless both `--execute-state-plan` and `--allow-origin` are present. It can infer selectors and URLs from A360, but credentials still come from `UIHEAL_LOGIN_USER` and `UIHEAL_LOGIN_PASS`; credentials and storage state files stay local and are ignored by git.

Review generated scripts before using execute mode against enterprise portals.

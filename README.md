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

Keep `.env` local. It is ignored by git.

## Stateful Login Planning

```powershell
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --stateful assist --allow-origin https://acme-test.uipath.com --state-plan-out reports/state-plan.review.playwright.ts
```

Review generated scripts before using execute mode against enterprise portals.

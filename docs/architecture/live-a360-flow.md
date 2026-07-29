# Live A360 Flow

Use this flow when the target portal and A360 Control Room are available in the same Windows or RDP desktop session.

1. Start Chrome with CDP:

```powershell
cd "C:\Program Files\Google\Chrome\Application"
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\chrome-dev-profile"
```

2. Open the A360 bot editor in that Chrome profile.

3. Open the target portal tab in the same Chrome profile.

4. Build and run deterministic preflight:

```powershell
pnpm build
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai off --report html --out reports/a360-preflight.html
```

5. Run AI guidance mode when OpenRouter is configured:

```powershell
$env:OPENROUTER_API_KEY="your-openrouter-key"
$env:UIHEAL_AI_MODEL="openrouter/auto"
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai guide --ai-provider openrouter --ai-model openrouter/auto --report html --out reports/a360-ai.html
```

6. Run stateful assist mode to generate a reviewable Playwright setup plan:

```powershell
node packages/cli/dist/index.js a360 preflight --cdp 9222 --file-id 100126347 --ai plan --stateful assist --allow-origin https://portal.company.com --state-plan-out reports/state-plan.review.playwright.ts --report html --out reports/a360-stateful.html
```

7. Review the report and generated state-plan script before using any write-back or execution mode.

The live preflight fetches bot content from inside the logged-in browser context. The A360 auth token is not returned to Node and must not be logged.

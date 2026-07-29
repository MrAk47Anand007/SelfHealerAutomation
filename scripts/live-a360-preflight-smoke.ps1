param(
  [int]$CdpPort = 9222,
  [Parameter(Mandatory = $true)]
  [string]$FileId,
  [string]$Out = "reports/a360-preflight.html",
  [string]$Ai = "off",
  [string]$AiModel = "openrouter/auto",
  [string]$Stateful = "manual",
  [string]$AllowOrigin = "",
  [string]$StatePlanOut = "reports/state-plan.review.playwright.ts"
)

pnpm --filter uiheal build

$argsList = @(
  "packages/cli/dist/index.js",
  "a360",
  "preflight",
  "--cdp", "$CdpPort",
  "--file-id", "$FileId",
  "--report", "html",
  "--out", "$Out",
  "--ai", "$Ai",
  "--ai-model", "$AiModel",
  "--stateful", "$Stateful"
)

if ($AllowOrigin) {
  $argsList += @("--allow-origin", "$AllowOrigin")
}

if ($StatePlanOut) {
  $argsList += @("--state-plan-out", "$StatePlanOut")
}

node @argsList

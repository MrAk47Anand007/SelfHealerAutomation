# AI Guidance With OpenRouter

UIHeal should use AI as an optional guidance and planning layer after deterministic validation has already run.

## Provider

OpenRouter is used through its OpenAI-compatible chat completions API:

```text
https://openrouter.ai/api/v1/chat/completions
```

Authentication uses:

```text
Authorization: Bearer $OPENROUTER_API_KEY
```

The default model should be configurable:

```powershell
$env:UIHEAL_AI_MODEL="openrouter/auto"
```

## Modes

- `off`: never call AI.
- `guide`: explain failed or repairable targets and recommend selectors.
- `plan`: guide plus stateful setup planning, such as login-required page preparation.

## Privacy Rules

AI prompts must include only compact evidence:

- target id
- automation tool
- old selectors
- confidence and validator signals
- top candidate summaries
- patch preview

Prompts must not include:

- cookies
- auth tokens
- passwords
- complete page HTML
- screenshots
- A360 Control Room auth data

## Stateful Planning

When post-login targets cannot be scanned because the browser is not in the right state, AI may help generate a reviewable Playwright setup script. The script must not auto-run unless a future explicit execution flag, origin allowlist, and credentials policy are satisfied.

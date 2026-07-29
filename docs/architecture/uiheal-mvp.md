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

## Optional AI Guidance

AI is an optional layer after deterministic validation. OpenRouter can be used for low-cost/free-model guidance through an OpenAI-compatible chat completions API, but prompts must be compact and redacted. The engine must still work with `--ai off`.

## Future Adapters

After the A360 proof works, add adapters for Playwright, Selenium, Puppeteer, Cypress, and Robot Framework. Each adapter should only translate that tool's artifacts into `UiTarget` and patch plans; validation remains in `@uiheal/core`.

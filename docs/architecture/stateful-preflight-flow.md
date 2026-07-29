# Stateful Preflight Flow

UIHeal groups targets by page state, detects login-required gaps, and can generate a reviewable Playwright setup script.

## Modes

- `manual`: report that the operator must prepare the browser state.
- `assist`: generate a Playwright setup script for review.
- `execute`: reserved for controlled execution and requires explicit `--execute-state-plan` plus `--allow-origin`.

## Safety

Generated scripts use `UIHEAL_LOGIN_USER` and `UIHEAL_LOGIN_PASS` environment variables. Credentials must not be written into bot JSON, reports, prompts, or logs.

UIHeal must not generate or execute destructive actions such as delete, approve, payment submission, export, or admin mutations.

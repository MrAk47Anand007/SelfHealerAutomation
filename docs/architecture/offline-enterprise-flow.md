# Offline Enterprise Flow

Use this flow when a portal is available only inside an RDP, VPN, or restricted enterprise desktop.

1. Run UIHeal inside the same desktop session as the browser.

2. Capture a local snapshot of candidate element evidence.

3. Run preflight against exported bot/test artifacts and the local snapshot.

4. Generate JSON or HTML reports for review.

5. Keep patch application preview-only unless an operator explicitly passes `--apply`.

The offline flow is designed to avoid cloud calls and avoid sending full page HTML, cookies, auth tokens, or raw headers outside the restricted environment.

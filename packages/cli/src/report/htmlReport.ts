import type { A360PreflightResult } from "../commands/a360.js";

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (char) => replacements[char] ?? char);
}

export function renderHtmlReport(result: A360PreflightResult): string {
  const rows = result.results
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.targetId)}</td><td>${item.status}</td><td>${item.confidence}</td><td>${escapeHtml(item.reason)}</td></tr>`
    )
    .join("");
  const aiWarning = result.aiWarning ? `<p><strong>AI guidance warning:</strong> ${escapeHtml(result.aiWarning)}</p>` : "";
  const stateWarning =
    typeof result.statePlan?.deterministicStatePlan === "object" &&
    result.statePlan.deterministicStatePlan &&
    "warning" in result.statePlan.deterministicStatePlan
      ? `<p><strong>State plan:</strong> ${escapeHtml(String(result.statePlan.deterministicStatePlan.warning))}</p>`
      : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>UIHeal A360 Preflight</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f6f8; }
  </style>
</head>
<body>
  <h1>UIHeal A360 Preflight</h1>
  <p>Total: ${result.summary.total}, Pass: ${result.summary.pass}, Repairable: ${result.summary.repairable}, Failed: ${result.summary.failed}</p>
  ${aiWarning}
  ${stateWarning}
  <table>
    <thead><tr><th>Target</th><th>Status</th><th>Confidence</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

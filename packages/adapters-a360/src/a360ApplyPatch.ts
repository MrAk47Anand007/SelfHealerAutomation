import type { A360BotContent } from "./a360Bot.js";

export function assertApplyAllowed(apply: boolean): void {
  if (!apply) throw new Error("Refusing to write changes without explicit --apply");
}

export function buildA360SaveBotExpression(fileId: string, bot: A360BotContent): string {
  return `(async () => {
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    const response = await fetch(location.origin + "/v2/repository/files/${fileId}/content?hasErrors=false", {
      method: "PUT",
      headers: { "X-Authorization": auth, "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "include",
      body: ${JSON.stringify(JSON.stringify(bot))}
    });
    if (!response.ok) throw new Error("A360 save failed with HTTP " + response.status);
    return { ok: true, status: response.status };
  })()`;
}

import type { A360BotContent } from "./a360Bot.js";

export interface FetchA360BotContentInput {
  origin: string;
  fileId: string;
  authToken: string;
  fetchImpl?: typeof fetch;
}

export function buildA360ContentUrl(origin: string, fileId: string): string {
  return `${origin.replace(/\/$/, "")}/v2/repository/files/${fileId}/content`;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      return /authorization|cookie|token/i.test(key) ? [key, "[REDACTED]"] : [key, value];
    })
  );
}

export async function fetchA360BotContent(input: FetchA360BotContentInput): Promise<A360BotContent> {
  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher(buildA360ContentUrl(input.origin, input.fileId), {
    headers: {
      "X-Authorization": input.authToken,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`A360 content fetch failed with HTTP ${response.status}`);
  return (await response.json()) as A360BotContent;
}

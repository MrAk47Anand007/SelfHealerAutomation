export interface A360SessionProbe {
  origin: string;
  fileId: string | null;
  hasAuthToken: boolean;
  contentUrl: string | null;
}

export function buildA360SessionProbeExpression(fileId?: string): string {
  return `(() => {
    const urlFileId = (location.hash.match(/files\\/task\\/(\\d+)/) || [])[1] || null;
    const resolvedFileId = ${JSON.stringify(fileId ?? null)} || urlFileId;
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    return {
      origin: location.origin,
      fileId: resolvedFileId,
      hasAuthToken: Boolean(auth),
      contentUrl: resolvedFileId ? location.origin + "/v2/repository/files/" + resolvedFileId + "/content" : null
    };
  })()`;
}

export function buildA360FetchBotExpression(fileId: string): string {
  return `(async () => {
    const auth = String(localStorage.authToken || "").replace(/^"|"$/g, "");
    const response = await fetch(location.origin + "/v2/repository/files/${fileId}/content", {
      headers: { "X-Authorization": auth, "Accept": "application/json" },
      credentials: "include"
    });
    if (!response.ok) throw new Error("A360 content fetch failed with HTTP " + response.status);
    return await response.json();
  })()`;
}

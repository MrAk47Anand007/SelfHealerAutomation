export type A360DecodedBlob = Record<string, unknown>;
export type A360SurroundingContext = Record<string, unknown> & { version: number };

export function decodeA360Blob(blob: string): A360DecodedBlob {
  return JSON.parse(Buffer.from(blob, "base64").toString("utf8")) as A360DecodedBlob;
}

export function encodeA360Blob(decoded: A360DecodedBlob): string {
  return Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
}

export function extractSurroundingContext(decoded: A360DecodedBlob): A360SurroundingContext | undefined {
  const advanceProperties = decoded.advanceProperties as { additionalProperties?: Record<string, string> } | undefined;
  const raw = advanceProperties?.additionalProperties?.aa_genai_surroundingContext;
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    ...parsed,
    version: typeof parsed.version === "number" ? parsed.version : 1
  };
}

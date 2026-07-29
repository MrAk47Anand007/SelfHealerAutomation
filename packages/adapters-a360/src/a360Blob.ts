export type A360DecodedBlob = Record<string, unknown>;
export type A360SurroundingContext = Record<string, unknown> & { version: number };
export type A360BlobSummary = {
  captureVersion?: number;
  topLevelKeys: string[];
  objNode?: Record<string, unknown>;
  additionalPropertyKeys?: string[];
  hasSurroundingContext: boolean;
};

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

function pickSafeScalar(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function summarizeObjNode(objNode: unknown): Record<string, unknown> | undefined {
  if (!objNode || typeof objNode !== "object") return undefined;
  const record = objNode as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of ["uniqueID", "name", "role", "tag", "type"]) {
    const safeValue = pickSafeScalar(record[key]);
    if (safeValue !== undefined) summary[key] = safeValue;
  }
  const path = record.path as { objPath?: unknown[] } | undefined;
  if (Array.isArray(path?.objPath)) summary.pathDepth = path.objPath.length;
  return Object.keys(summary).length > 0 ? summary : undefined;
}

export function summarizeA360Blob(decoded: A360DecodedBlob): A360BlobSummary {
  const advanceProperties = decoded.advanceProperties as { additionalProperties?: Record<string, unknown> } | undefined;
  const additionalProperties = advanceProperties?.additionalProperties;
  return {
    captureVersion: typeof decoded.captureVersion === "number" ? decoded.captureVersion : undefined,
    topLevelKeys: Object.keys(decoded).sort(),
    objNode: summarizeObjNode(decoded.objNode),
    additionalPropertyKeys: additionalProperties ? Object.keys(additionalProperties).sort() : undefined,
    hasSurroundingContext: Boolean(additionalProperties?.aa_genai_surroundingContext)
  };
}

const sensitiveKeyPattern = /authorization|cookie|token|password|secret|credential|session/i;

export function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/(password\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)\S+/gi, "$1[REDACTED]");
}

export function redactGuidanceEvidence(input: unknown): unknown {
  if (typeof input === "string") return redactText(input);
  if (Array.isArray(input)) return input.map(redactGuidanceEvidence);
  if (!input || typeof input !== "object") return input;

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (sensitiveKeyPattern.test(key)) return [key, "[REDACTED]"];
      return [key, redactGuidanceEvidence(value)];
    })
  );
}

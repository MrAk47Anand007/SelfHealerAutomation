const SECRET_KEY_PATTERN = /password|passwd|pass|secret|token|auth|authorization|cookie|session|api[-_]?key/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9._-]+|gho_[a-z0-9_]+|eyj[a-z0-9._-]+)/i;

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && SECRET_VALUE_PATTERN.test(value)) return "[redacted]" as T;
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY_PATTERN.test(key) && typeof item === "string" ? "[redacted]" : redactSecrets(item);
  }
  return output as T;
}

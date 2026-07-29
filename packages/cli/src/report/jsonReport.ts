export function renderJsonReport(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

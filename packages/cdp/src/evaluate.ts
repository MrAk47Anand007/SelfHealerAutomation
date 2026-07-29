import type { CdpRuntime } from "./runtime.js";

export interface RuntimeEvaluateInput {
  expression: string;
  contextId?: number;
  awaitPromise?: boolean;
}

export function extractRuntimeValue<T>(response: any): T {
  const exceptionText = response?.result?.exceptionDetails?.text;
  if (exceptionText) throw new Error(exceptionText);
  return response?.result?.result?.value as T;
}

export async function evaluateInContext<T>(runtime: CdpRuntime, input: RuntimeEvaluateInput): Promise<T> {
  const params: Record<string, unknown> = {
    expression: input.expression,
    returnByValue: true,
    awaitPromise: input.awaitPromise ?? true
  };
  if (typeof input.contextId === "number") params.contextId = input.contextId;
  const response = await runtime.send("Runtime.evaluate", params);
  return extractRuntimeValue<T>(response);
}

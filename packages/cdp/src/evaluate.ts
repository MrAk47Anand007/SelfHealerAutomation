import type { CdpRuntime } from "./runtime.js";

export interface RuntimeEvaluateInput {
  expression: string;
  contextId?: number;
  awaitPromise?: boolean;
}

export function extractRuntimeValue<T>(response: any): T {
  const exceptionDetails = response?.result?.exceptionDetails;
  if (exceptionDetails) {
    const exception = exceptionDetails.exception;
    const stack = exceptionDetails.stackTrace?.callFrames
      ?.slice(0, 3)
      .map((frame: any) => `${frame.functionName || "<anonymous>"} (${frame.url || "eval"}:${frame.lineNumber}:${frame.columnNumber})`)
      .join("; ");
    const message = [
      exception?.description,
      exception?.value,
      exceptionDetails.text,
      stack ? `Stack: ${stack}` : undefined
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(message || "CDP Runtime.evaluate failed");
  }
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

export interface StatePlanExecutionSafetyInput {
  execute: boolean;
  allowOrigin?: string;
}

export function isDestructiveActionText(text: string): boolean {
  return /delete|remove|approve|payment|pay now|submit payment|admin|export|terminate|disable/i.test(text);
}

export function assertStatePlanExecutionAllowed(input: StatePlanExecutionSafetyInput): void {
  if (!input.execute) throw new Error("Refusing to execute state plan without --execute-state-plan");
  if (!input.allowOrigin) throw new Error("Refusing to execute state plan without --allow-origin");
}

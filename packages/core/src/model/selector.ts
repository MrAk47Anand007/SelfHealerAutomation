import type { UiSelector } from "./types.js";

export function normalizeSelector(input: UiSelector): UiSelector {
  return {
    ...input,
    value: input.value.trim()
  };
}

export function selectorToLabel(selector: UiSelector): string {
  return `${selector.kind}:${selector.value}`;
}

export function enabledSelectors(selectors: UiSelector[]): UiSelector[] {
  return selectors.map(normalizeSelector).filter((selector) => selector.enabled && selector.value.length > 0);
}

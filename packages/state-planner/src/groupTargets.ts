import type { UiTarget } from "@uiheal/core";

export interface UiTargetStateGroup {
  stateId: string;
  origin?: string;
  url?: string;
  targets: UiTarget[];
}

function stateIdFor(url?: string): { stateId: string; origin?: string } {
  if (!url) return { stateId: "unknown" };
  const parsed = new URL(url);
  return { stateId: parsed.pathname || "/", origin: parsed.origin };
}

export function groupTargetsByState(targets: UiTarget[]): UiTargetStateGroup[] {
  const groups = new Map<string, UiTargetStateGroup>();
  for (const target of targets) {
    const { stateId, origin } = stateIdFor(target.url);
    const key = `${origin ?? ""}${stateId}`;
    const group = groups.get(key) ?? { stateId, origin, url: target.url, targets: [] };
    group.targets.push(target);
    groups.set(key, group);
  }
  return [...groups.values()];
}

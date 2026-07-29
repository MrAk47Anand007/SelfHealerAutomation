import type { UiSelector, UiTarget } from "@uiheal/core";
import type { UiTargetStateGroup } from "./groupTargets.js";

export interface InferredLoginSelectors {
  username: string;
  password: string;
  submit: string;
  expectedUrlPattern?: string;
  sources: {
    username: "a360" | "fallback";
    password: "a360" | "fallback";
    submit: "a360" | "fallback";
    expectedUrlPattern: "a360" | "fallback";
  };
}

export interface LoginSelectorOverrides {
  username?: string;
  password?: string;
  submit?: string;
  expectedUrlPattern?: string;
}

const FALLBACK_USERNAME = "input[name='email'], input[type='email'], input[name='username']";
const FALLBACK_PASSWORD = "input[type='password']";
const FALLBACK_SUBMIT = "button[type='submit'], input[type='submit']";

function cssAttribute(name: string, value: string): string {
  return `[${name}="${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"]`;
}

function selectorValue(selector: UiSelector): string | undefined {
  if (!selector.enabled || !selector.value) return undefined;
  if (selector.kind === "css") return selector.value;
  if (selector.kind === "xpath") return `xpath=${selector.value}`;
  if (selector.kind === "id") return cssAttribute("id", selector.value);
  if (selector.kind === "name") return cssAttribute("name", selector.value);
  if (selector.kind === "text") return `text=${selector.value}`;
  return undefined;
}

function bestSelectorFor(target: UiTarget): string | undefined {
  const priority: UiSelector["kind"][] = ["css", "id", "name", "xpath", "text"];
  for (const kind of priority) {
    const selector = target.selectors.find((item) => item.kind === kind);
    const value = selector ? selectorValue(selector) : undefined;
    if (value) return value;
  }
  if (target.element.id) return cssAttribute("id", target.element.id);
  if (target.element.name) return cssAttribute("name", target.element.name);
  return undefined;
}

function textFor(target: UiTarget): string {
  return [
    target.id,
    target.action,
    target.element.type,
    target.element.id,
    target.element.name,
    target.element.text,
    target.element.label,
    target.element.classes?.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreUsername(target: UiTarget): number {
  const text = textFor(target);
  let score = target.element.tag === "input" ? 2 : 0;
  if (/email/.test(text)) score += 8;
  if (/user|username|login/.test(text)) score += 5;
  if (/text|email/.test(target.element.type ?? "")) score += 3;
  if (/password|pass/.test(text)) score -= 20;
  return score;
}

function scorePassword(target: UiTarget): number {
  const text = textFor(target);
  let score = target.element.tag === "input" ? 2 : 0;
  if (target.element.type === "password") score += 20;
  if (/password|pass/.test(text)) score += 8;
  return score;
}

function scoreSubmit(target: UiTarget): number {
  const text = textFor(target);
  let score = /click|press|select/.test(target.action ?? "") ? 3 : 0;
  if (["button", "a"].includes(target.element.tag ?? "")) score += 6;
  if (target.element.type === "submit") score += 8;
  if (/login|log in|signin|sign in|submit|continue/.test(text)) score += 10;
  if (/forgot|reset|cancel/.test(text)) score -= 20;
  return score;
}

function highest(groups: UiTargetStateGroup[], scorer: (target: UiTarget) => number): UiTarget | undefined {
  return groups
    .flatMap((group) => group.targets)
    .map((target) => ({ target, score: scorer(target) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.target;
}

function expectedUrlPatternFrom(groups: UiTargetStateGroup[]): string | undefined {
  const url = groups.find((group) => group.url)?.url;
  if (!url) return undefined;
  const parsed = new URL(url);
  return `**${parsed.pathname}${parsed.search ? parsed.search : ""}*`;
}

export function inferLoginSelectors(input: {
  loginState?: UiTargetStateGroup;
  missingStates: UiTargetStateGroup[];
  overrides?: LoginSelectorOverrides;
}): InferredLoginSelectors {
  const loginGroups = input.loginState ? [input.loginState] : [];
  const username = highest(loginGroups, scoreUsername);
  const password = highest(loginGroups, scorePassword);
  const submit = highest(loginGroups, scoreSubmit);
  const expectedUrlPattern = expectedUrlPatternFrom(input.missingStates);

  const inferredUsername = username ? bestSelectorFor(username) : undefined;
  const inferredPassword = password ? bestSelectorFor(password) : undefined;
  const inferredSubmit = submit ? bestSelectorFor(submit) : undefined;

  return {
    username: input.overrides?.username ?? inferredUsername ?? FALLBACK_USERNAME,
    password: input.overrides?.password ?? inferredPassword ?? FALLBACK_PASSWORD,
    submit: input.overrides?.submit ?? inferredSubmit ?? FALLBACK_SUBMIT,
    expectedUrlPattern: input.overrides?.expectedUrlPattern ?? expectedUrlPattern,
    sources: {
      username: input.overrides?.username || inferredUsername ? "a360" : "fallback",
      password: input.overrides?.password || inferredPassword ? "a360" : "fallback",
      submit: input.overrides?.submit || inferredSubmit ? "a360" : "fallback",
      expectedUrlPattern: input.overrides?.expectedUrlPattern || expectedUrlPattern ? "a360" : "fallback"
    }
  };
}

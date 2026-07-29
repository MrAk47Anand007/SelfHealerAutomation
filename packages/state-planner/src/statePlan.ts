import type { UiTargetStateGroup } from "./groupTargets.js";
import type { LoginRequirement } from "./loginDetector.js";
import { generatePlaywrightSetupScript } from "./playwrightScript.js";

export interface DeterministicStatePlan {
  mode: "manual" | "assist" | "execute";
  required: boolean;
  warning?: string;
  script?: string;
}

export function createDeterministicStatePlan(input: {
  mode: "manual" | "assist" | "execute";
  loginRequirement: LoginRequirement;
  loginState?: UiTargetStateGroup;
}): DeterministicStatePlan {
  if (!input.loginRequirement.required) {
    return { mode: input.mode, required: false };
  }
  const loginUrl = input.loginRequirement.loginState?.url ?? input.loginState?.url;
  if (input.mode === "manual" || !loginUrl) {
    return {
      mode: input.mode,
      required: true,
      warning: "Login/authenticated browser state is required before all targets can be scanned."
    };
  }
  return {
    mode: input.mode,
    required: true,
    warning: "Review generated Playwright setup script before execution.",
    script: generatePlaywrightSetupScript({
      loginUrl,
      usernameSelector: "input[name='email'], input[type='email'], input[name='username']",
      passwordSelector: "input[type='password']",
      submitSelector: "button[type='submit'], button:has-text('Login'), button:has-text('Sign in')",
      expectedUrlPattern: "**/*"
    })
  };
}

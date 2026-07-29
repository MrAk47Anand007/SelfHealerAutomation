import type { UiTargetStateGroup } from "./groupTargets.js";

export interface LoginRequirement {
  required: boolean;
  loginState?: UiTargetStateGroup;
  missingStates: UiTargetStateGroup[];
  reason: string;
}

export function detectLoginRequirement(groups: UiTargetStateGroup[], currentOpenUrls: string[]): LoginRequirement {
  const loginState = groups.find((group) => /login|signin|sign-in|auth/i.test(group.stateId));
  const missingStates = groups.filter((group) => group.url && !currentOpenUrls.some((url) => url.startsWith(group.url ?? "")));
  return {
    required: Boolean(loginState && missingStates.some((group) => group !== loginState)),
    loginState,
    missingStates: missingStates.filter((group) => group !== loginState),
    reason: loginState ? "Login-like state exists and post-login states are not currently open" : "No login-like state detected"
  };
}

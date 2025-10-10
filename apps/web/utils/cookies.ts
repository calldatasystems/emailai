export const ASSISTANT_ONBOARDING_COOKIE = "viewed_assistant_onboarding";
export const REPLY_AI_ONBOARDING_COOKIE = "viewed_reply_ai_onboarding";

export function markOnboardingAsCompleted(cookie: string) {
  document.cookie = `${cookie}=true; path=/; max-age=${Number.MAX_SAFE_INTEGER}`;
}

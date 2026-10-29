// Calm, non-technical copy for AI features. Provider names, models and raw errors stay in server logs.
export const AI_LOADING = "Your personalized style edit is on its way…";

const RESTING = "Your stylist is resting for now — today's AI styling allowance has been used. Everything you've saved is still here; please try again later.";
const MOMENT = "Your stylist needs a moment. Please try again.";

const MESSAGES = {
  stylist_busy: { text: "Your stylist is still finishing the last request — give it a few seconds.", retry: true },
  insights_busy: { text: "Your notes are already being written — give it a few seconds.", retry: true },
  provider_unavailable: { text: RESTING, retry: false },
  provider_configuration: { text: RESTING, retry: false },
  provider_quota: { text: RESTING, retry: false },
  provider_credentials: { text: RESTING, retry: false },
};

/** { text, retry } for an AI error response. Unknown or temporary errors can be retried. */
export function aiErrorMessage(data = {}, status = 0) {
  if (MESSAGES[data.errorCode]) return MESSAGES[data.errorCode];
  if (data.retryable === false) return { text: RESTING, retry: false };
  return { text: status === 0 ? "We couldn't reach MatchMyTone just now. Check your connection and try again." : MOMENT, retry: true };
}

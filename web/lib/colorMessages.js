// Friendly copy keyed by the API's errorCode. Provider names, status codes and raw errors stay in backend logs.
export function analysisErrorMessage(result) {
  const retryIn = result?.retryAfterSeconds ? ` Please try again in about ${result.retryAfterSeconds} seconds.` : "";
  const messages = {
    provider_temporary: `We couldn't finish your color analysis just yet. Your selfie is saved on this page — please try again.${retryIn}`,
    provider_malformed: "We couldn't read your colors clearly from this selfie. Please try again, or retake it in soft daylight.",
    provider_unavailable: "Color analysis is resting right now and can't take new selfies. Your selfie is saved on this page — please try again a little later.",
    provider_configuration: "Color analysis is resting right now and can't take new selfies. Please try again a little later.",
    analysis_in_progress: "Your previous selfie is still being analysed. Please wait a moment, then try again.",
    persistence_failed: "Your colors are ready, but we couldn't save them yet. Try again to save them — your selfie won't be analysed twice.",
    database_unavailable: "We can't save results right now. Your selfie is saved on this page — please try again shortly.",
    invalid_image: "We couldn't read that photo. Please retake your selfie.",
  };
  return messages[result?.errorCode] || "We couldn't finish your color analysis just yet. Your selfie is saved on this page — please try again.";
}

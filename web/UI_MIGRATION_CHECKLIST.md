# MatchMyTone web migration checklist

The Next.js web app preserves the existing Flask/MongoDB architecture and uses the Expo app under `app/` as a visual and behavior reference.

| Area | Route | Status |
| --- | --- | --- |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password` | Implemented with Flask/JWT integration |
| Dashboard | `/dashboard` | Four analysis cards, Results entry, responsive shared header |
| Profile | `/profile`, `/profile/edit` | Implemented with protected API calls |
| Results history | `/results`, `/results/[type]/[id]` | MongoDB-backed, ownership-protected, separate result pages |
| Color camera | `/analyses/color` | Live camera only; capture, retake, retry, backend Gemini proxy |
| Color result | `/analyses/color/result` | Saved result loading, selfie, palette, browse looks, PDF summary |
| Skincare quiz/result | `/analyses/skincare`, `/analyses/skincare/result` | Questionnaire, persisted result, concern-aware products |
| Body/face quiz/result | `/analyses/body-shape`, `/analyses/body-shape/result`, `/analyses/face-shape`, `/analyses/face-shape/result` | Existing scoring and dedicated result flows preserved |

## Remaining manual checks

- Add a real `GEMINI_API_KEY` to the ignored `backend/.env` before testing a live Gemini request.
- Test camera permission and capture on a supported HTTPS browser with a physical camera.
- Verify official product pages and image availability during deployment.

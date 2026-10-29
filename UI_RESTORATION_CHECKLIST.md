# UI restoration checklist

- [x] Keep the MongoDB, Flask, authentication, and ownership architecture intact.
- [x] Public home page at `/`; login and register links in the header.
- [x] Dashboard with four analysis cards; no "Saved to your history" message and no "Your Saved Analyses" card.
- [x] Header: Results link, Profile icon that opens `/profile`, and a separate Logout button.
- [x] Color Analysis is live-camera-only, with permission, secure-context, retry, capture, retake, and cleanup handling. There is no upload fallback.
- [x] Color Analysis shows progress, prevents double submission, keeps the selfie for retry, and stops waiting after 120 s.
- [x] Analysis results on dedicated routes, loaded from the authenticated API; saved results reopen from `/results`.
- [x] Result images that existed only in the mobile `assets/` folder are copied to `web/public/assets`.
- [x] Forgot-password (email → reset link) and reset-password (link token → new password) pages.
- [x] Production build, lint, and live HTTP smoke test (2026-10-26).
- [ ] Manually test camera permission and capture on a supported HTTPS browser with a physical camera.
- [ ] Visually review every page at mobile and desktop widths in a browser.

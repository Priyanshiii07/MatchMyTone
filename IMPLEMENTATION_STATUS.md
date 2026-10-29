# MatchMyTone implementation status

Updated: 2026-10-26. Every "verified" item below was exercised on that date; mocked tests are listed separately from live checks.

## Architecture

- `web/`: Next.js 15.5 (App Router) web app. Server routes in `web/app/api/` proxy to Flask and hold the JWT in an httpOnly cookie (`matchmytone_access`).
- `backend/`: Flask API on MongoDB (`pymongo`). `color_providers.py` contains the Color Analysis provider chain; `app.py` contains the routes.
- Legacy Expo app (`app/`, `src/`): kept for reference. It is not part of the web submission.

## Color Analysis

Flow: browser camera frame → client brightness check → JPEG (≤1024 px, quality 0.84) → `POST /api/analyze/color` (Next) → Flask validates the frame → provider chain → schema normalization and validation → saved to `color_analysis_results` → result page loads the saved document by id.

- Provider order: `GEMINI_MODEL`, then `GEMINI_FALLBACK_MODELS`, then OpenAI (`OPENAI_VISION_MODEL`). Each candidate is called at most once, and all of them share one `COLOR_ANALYSIS_MAX_SECONDS` budget.
- Failures that move to the next candidate: 503/5xx, timeouts, rate limits, exhausted quota, an unavailable model, and malformed output. An invalid key skips the rest of that provider's models. Exhausted quota or an invalid key puts that provider/model on cooldown (15 or 10 minutes) so later requests skip it immediately.
- A result is persisted on the server with a per-selfie `request_id`. Duplicate submissions return the saved result without calling the AI again. If the AI succeeds but MongoDB fails, the response is `persistence_failed` and a retry saves the result without re-analysis.
- If no provider succeeds, the API returns 503 with an `errorCode` and no fabricated result. A non-face or poorly lit image returns `isFace: false` with retake guidance and is not saved.

### Live results (2026-10-26, fixture selfie `assets/dp.jpg`)

| Check | Result |
| --- | --- |
| Gemini key / model list | Valid (HTTP 200) |
| `gemini-3.8-flash` (old primary) | Correct output but 76–85 s, or a timeout at 90 s; it can't finish inside a 45 s timeout |
| `gemini-3.5-flash` / `gemini-3.6-flash` | 4–35 s typical; intermittent 503 "high demand" |
| `gemini-2.5-flash` | 404: no longer available to new users |
| OpenAI key / model list | Valid (HTTP 200) |
| OpenAI image request | **429 `insufficient_quota` / `credit_balance_exhausted`**: account credit is exhausted |
| End-to-end analysis through the web server | 5/5 succeeded: 90.8 s, 45.1 s (3.5-flash 503 → failover to 3.6-flash), 34.8 s, 4.4 s, 4.2 s |
| Non-face image | `isFace: false`, not saved |
| Live OpenAI fallback | **Not verified**: blocked by the account quota |

## Verified on 2026-10-26

- Backend: `pytest` 51 passed (mocked providers, isolated `matchmytone_test` database).
- Web: `npm run lint` 0 errors (8 pre-existing `<img>`/ref warnings); `npm run build` succeeded, 28 routes.
- Live end-to-end smoke test (39/39 checks) through `next start` → Flask → MongoDB → Gemini:
  - Public home page, plus logged-out redirects for every protected page
  - Registration, case-insensitive duplicate rejection, wrong password, httpOnly cookie login
  - Dashboard with four modules
  - Live color analysis saved, reloaded, and downloaded as PDF
  - Skincare, body, and face results saved once per completion and reopened from Results
  - Cross-account access returns 404
  - Logout removes access

## Implemented but not live-verified

- Camera permission and capture in a real browser on HTTPS (the code handles denied, unsupported, and insecure contexts).
- Visual layout and the browser console in an interactive session (only server responses were checked).
- Email: Resend delivery for verification and password reset. `RESEND_API_KEY` is empty, so `request-password-reset` correctly returns 503 `email_not_configured`.
- OpenAI fallback for real images (mocked tests only).
- Product links and images in `web/lib/products.js` (not re-checked against live retailer pages).

## Known limitations

- Gemini latency is dominated by provider load. A request can take up to the 90 s budget; the browser stops waiting after 120 s and keeps the selfie for retry.
- Skincare, body, and face results are scored on the client from questionnaire answers. The server validates the allowed result values and ownership, but does not recompute the score.
- `next` 15.5.28 bundles a PostCSS version with advisories (build-time only); the fix requires Next 16.
- API responses use `{error, errorCode}` / resource bodies, not the `{success, data, message, errorCode, timestamp}` wrapper. Changing this would also require frontend changes.

## Website redesign and PDF repair (verified 2026-10-27)

- **PDF root cause:** the Color result page requested `/api/quiz/color-analysis/<id>/pdf`, but the backend type map had no `color-analysis` alias, so it returned 400 and the UI showed "The summary could not be generated." The alias has been added. `backend/pdf_reports.py` now builds branded, multi-page reports for all four modules (swatches, findings, recommendations, answers, page numbers, escaped text, older document formats supported). A failure returns `pdf_failed` JSON so the browser can offer a retry.
- **Shared content:** face, body and skincare guide text lives in `web/lib/style-guides.json`, with an identical copy in `backend/style_guides.json`. A test fails if the two drift apart.
- **Back navigation:** `NavigationTracker` (root layout) and `BackButton` go to the previous page only if it was a page on this site; otherwise they use a set fallback page. Signed-in pages never send you back to a login page, and Back asks for confirmation before discarding a selfie, unfinished quiz answers or unsaved profile edits.
- **Shared result views:** the live result pages and `/results/[type]/[id]` render the same components; saved results no longer show raw JSON.
- **Tests:**
  - Backend pytest: 64 passed.
  - Web Jest + React Testing Library: 35 passed.
  - ESLint: 0 errors.
  - `next build`: 28 routes.
  - Real-browser Playwright journey (fake camera fed by `assets/dp.jpg`, live Gemini): 55/55 checks on the final build. A live provider failure was also caught and recovered through "Try again" in one run.

## Gender-aware personalization and styling (2026-10-27)

**Root cause of the women's clothing for male users:** `style-guides.json` held one recommendation list per body/face shape, all womenswear, and `ShapeResultView` and the PDF rendered it for everyone. Gender was stored in `user_profiles` but no recommendation code read it.

### Preference model
- `user_profiles.style_preferences` (optional, validated against `backend/preference_options.json`; web copy in `web/lib/preference-options.json`, drift-tested). Fields: `catalog` (menswear / womenswear / unisex / mixed), `presentation`, `style_extras` (modest, traditional), `fit`, `occasions`, `hair_length`, `hair_texture`, `facial_hair`, `maintenance`, `makeup`.
- Catalog resolution (`preferences.resolve`): explicit choice, then profile gender (male → menswear, female → womenswear), then neutral unisex with `needs_choice: true`; the UI then asks the user.
- API: `GET/PUT /api/users/preferences`; registration accepts optional `style_preferences`. Gender is now optional everywhere.
- AI never writes preferences. Color Analysis no longer requests `detectedGender`, sends no gender to the provider, and no longer rejects selfies with `profile_mismatch`.

### Recommendation engine (backend is the source of truth)
- `backend/styling.py` + versioned `backend/style_catalog.json`: body, face and color styling. `backend/skincare.py` + `skincare_catalog.json`: routines from answers and optional extras only (never gender).
- Each saved result stores a `styling` (or skincare `plan`) snapshot with `catalog_version` and the preferences used, so old results never change when preferences change. `PUT /api/quiz/<type>/<id>/styling` regenerates only the styling of one result (the analysis is untouched; no AI call).
- Results saved before this change get recommendations from current preferences, flagged `provisional`, and nothing is written back.
- Body/face results also store `confidence` (from answer margins). Questionnaire ties now break by a fixed shape order (the answering order previously changed the result).
- Saved styles: `style_favorites` collection, `GET/POST/DELETE /api/favorites`; display fields come from the catalog, not the client.
- `POST /api/quiz/color-analysis` now returns 405: color results can only come from `/api/analyze/color`.

### Website
- Shared `ResultView` (live + reopened results), catalog switcher/chooser, filterable recommendation cards with palette shades and favorites, Face beard section only on request, opt-in makeup ideas, Color "Wear your palette" outfits + undertone metals, Skincare morning/evening tabs and optional shaving/beard/workout/makeup sections.
- Original SVG garment/hair/beard illustrations (`StyleArt.js`); neutral shape outlines (`ShapeDiagram.js`) outside the women's catalog.
- New SVG logo (`Logo.js`, `public/brand/matchmytone-logo.svg`, `public/brand/matchmytone-icon.svg`, `app/icon.svg`) in the header, footer and home hero; mobile menu; redesigned home page and dashboard; completion celebration (disabled for reduced motion).
- No new npm dependencies (Tailwind, lucide-react, etc. are not installed; the existing CSS design system and icon set were extended).

### Verified on 2026-10-27
- Backend `pytest`: 104 passed (mocked providers, isolated `matchmytone_test`). `py_compile`: OK.
- Web Jest + RTL: 154 passed. ESLint: 0 errors (1 pre-existing warning in `analyses/color/page.js`). `next build`: OK.
- Real-browser Playwright journey (`next start` → Flask → MongoDB `matchmytone_e2e`): 43/43 checks, 0 console errors. A separate run made one live Gemini color analysis (Warm Autumn, 9 s): men's outfits, switch to women's with the palette unchanged, PDF download.
- Web fixtures in `web/lib/__fixtures__/styling.json` are generated by `backend/scripts/export_web_fixtures.py`; a backend test fails if they drift.

### Not done / limitations
- Budget preference not implemented: the catalog holds no prices, and prices are not invented.
- Skincare products are the same six verified-by-link products as before (not re-checked against live retailer pages); shaving/beard guidance is product-agnostic.
- OpenAI fallback for real images still unverified live (account credit exhausted).
- Men's and unisex cards use illustrations; only women's items with existing matching photos use photos.

## Repair, AI explanations, trends and saved progress (2026-10-27, later)

### Root cause of "We couldn't build a routine" and "Nothing matches these filters"
The Flask process on port 5000 (PID 17240, started 26 Oct 14:55) was still running the code from before personalisation; `/api/users/preferences` and `/api/favorites` returned 404 there. The hot-reloaded web app saved results through that old API, which returned no `plan`/`styling`. The web app then (a) showed "Saved to your results journal" next to a missing routine and (b) showed a filter empty state when there was no data at all.
**Restart the backend** so it runs the current code (`GET /api/health` now reports `api_version: 2`).
Fixes so this can't mislead again:
- `hasRecommendations()` (web/lib/results.js): the success notice and celebration appear only for complete results; otherwise `MissingRecommendations` offers Try again (re-fetch, no duplicate save).
- Reopening a skincare result without a routine rebuilds it from the saved answers and saves it (only if still missing).
- Filters: every option shows its count, options with no matches are disabled, and an empty combination names the filters responsible and offers Reset filters.

### Restored / added
- Skincare products grouped by function (cleanse/hydrate/treat/moisturise/protect) with ingredient explanations; routine checklist ticks and favourite shades are now saved on the result in MongoDB (`user_state`, `PUT /api/quiz/<type>/<id>/progress`) instead of one browser's localStorage. Older localStorage ticks are not migrated.
- Face hairstyle studio: length and upkeep filters over all suggested cuts. Palette studio: saved shades and colour-wheel harmonies (labelled as calculated, not AI).
- AI stylist notes (`POST /api/quiz/<type>/<id>/insights`, `backend/ai_insights.py`): on request, the AI explains the engine's existing items; it can reference only those item ids, output is length-capped and stripped of markup/links, medical-claim wording is rejected, and the notes are saved with the result. Failures leave recommendations untouched.
- Live trends (`GET /api/quiz/<type>/<id>/trends`, `backend/trends.py`): Gemini **Grounding with Google Search**. A trend line is kept only if the grounding metadata links that line to a web source; publisher and link are shown with the retrieval date; publication dates are not supplied and never invented. Cached in `trend_cache` per topic for `TREND_CACHE_DAYS` (7); stale cache is served (labelled) if a refresh fails; with no cache the page says trends are unavailable. Google's search suggestions are rendered in a sandboxed iframe as the grounding terms require.
- Provider chain refactored into `color_providers.run_chain` (shared by color analysis, notes and trends). Quota/rate-limit cooldowns are now scoped, so an exhausted search-grounding quota can't block color analysis; invalid credentials still apply everywhere.

### Live verification (2026-10-27)
- AI stylist notes: **verified once live** with Gemini (body result, 12 notes, 15 s). Later requests hit the key's quota (HTTP 429) and failed honestly.
- Trends: **not verifiable live** — this key returns HTTP 429 RESOURCE_EXHAUSTED for every request that uses the Google Search tool (plain requests worked). Grounding needs a Gemini plan/quota that includes Google Search. Until then the trends panel shows "not available" and nothing is invented.
- OpenAI fallback: credit exhausted (429), unchanged.

### Tests (this pass)
- Backend pytest 120 passed (mocked providers). Web Jest 164 passed. ESLint 0 errors. `next build` OK.
- Playwright journey (isolated `matchmytone_e2e`, since dropped): 49/49 checks. One console entry: the 503 from the AI-notes request made while the provider quota was exhausted, shown to the user as a friendly message.

## Master pass: error audit, trends, AI stylist, looks, board (2026-10-27, evening)

### Root cause of every on-screen error in this round
All four messages ("couldn't load your personalised routine/recommendations", "Nothing matches these filters", "couldn't write your personal notes", "Live trend highlights aren't available") came from the same place: **two backend processes are listening on port 5000**.
- PID 17240 (and its reloader parent 13160) was started on **26 Oct, 14:55**, before personalisation existed. It has no `/api/users/preferences`, `/favorites`, `/insights` or `/trends` routes (all 404) and its health check has no `api_version`. It is connected to **`matchmytone_smoke`** (a test database), not `matchmytone`.
- PID 4896 was started on 27 Oct, 20:15 with the current code.
- Windows lets both bind the port, and the stale one keeps answering. Results saved while it answered went to `matchmytone_smoke`.

**Fix (must be done by you; the assistant was not permitted to stop your processes):**
```
taskkill /PID 17240 /F
taskkill /PID 13160 /F
```
Then check that `http://127.0.0.1:5000/api/health` shows `"api_version": 2` and `"database_name": "matchmytone"`.

The web app now detects this itself: the recovery notice and the AI-notes error call `/api/health` and say "the server answering this page is an older version" when `api_version` is missing. Try again shows a spinner, ignores double clicks and reports "still not available after N retries".

### Trends (replaces Gemini search grounding, which this key's quota blocks)
`backend/trends.py` reads the official RSS feeds of Vogue, GQ, Allure, Harper's Bazaar, Elle and Fashionista (all verified live today). Only the headline, publication date, a short excerpt and a link are shown. Links must be https on the publisher's own domain. Each feed is cached in `trend_cache` for 6 hours; a failed refresh serves the last copy, labelled with its retrieval time. Articles are matched to the module and result by keywords (shown to the user as "why you're seeing this"), with a minimum relevance score, and colour stories must be about clothes. When nothing matches, or the feeds are unreachable, the page shows **evergreen ideas** (`backend/evergreen_inspiration.json`), labelled "timeless styling advice, not current trends". No API key is needed. Byrdie (403) and The Cut (404) feeds were not usable.

### New features
- **AI stylist chat** (`/stylist`, `POST /api/stylist/chat`): answers from the user's own latest saved results; products may only be named from their routine; links/markup stripped; medical-claim wording rejected; conversation kept in the browser tab only.
- **Occasion look generator** (`POST /api/stylist/looks`): candidates come from the catalog (catalog override, modest flag, comfort fit, focus category) and the user's real palette; the AI may only pick those ids/colours. When AI is unavailable, the user gets complete rule-based outfits (top, bottom, layer, shoes; sarees/lehengas/kurta sets treated as whole outfits) labelled "Styling rules". Budget is acknowledged but not applied (no price data).
- **Inspiration board** (`/board`): saved catalog styles, skincare products and validated looks (`backend/favorites.py`), plus favourite shades from colour results.
- **Regenerate**: "Refresh with my current preferences" on every styled result; previous snapshots are kept in `styling_history` (last 5).
- **Skincare coach**: "why this step is here" for every step, a simplest-routine toggle, verified in-catalog alternatives per product (or "no other verified option"), and saving products to the board.
- **Filters**: Body adds comfort & fit and palette-shade filters; Face adds a texture filter (shown only when texture-specific cuts exist). Budget filtering is explicitly not offered.
- **Dashboard**: the four "Last result" blocks were removed (saved results, the Results page and history are unchanged); entry cards for the AI stylist, board and Results journal were added.
- Lightweight toasts (no new dependency).

### Tests (this pass)
- Backend `pytest`: **130 passed** (all providers and feeds mocked; isolated `matchmytone_test`).
- Web Jest: **169 passed**; ESLint 0 errors (1 pre-existing warning); `next build` OK (`/stylist`, `/board` added).
- Playwright journey (isolated `matchmytone_e2e`, dropped afterwards): **57/57**. It covered live RSS trends showing real dated articles, chat and notes reporting the exhausted AI quota honestly, rule-based looks for a male user with no womenswear, saving a look to the board, checklist persistence and no "Last result" on the dashboard.
- **Live AI**: chat, notes and AI-written looks were *not* verifiable today — Gemini returned 429 quota and OpenAI has no credit. Their failure paths were verified live; their success paths are covered by mocked tests (and the notes endpoint succeeded live once earlier today).

## Final UI/UX redesign and hosting readiness (2026-10-29)

### AI root cause and resilience
- Failures were the Gemini free tier's **per-model daily quota** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`), plus a configured fallback (`gemini-3.8-flash`) that times out.
- Models verified live on 2026-10-29: `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` answer; the 2.5 models return 404.
- Selfie analysis uses `gemini-3.5-flash`, then `gemini-3.6-flash`, then `gemini-3.1-flash-lite`. Text features (chat, looks, notes) use `GEMINI_TEXT_MODELS`, which leads with lite models. Each model has its own free daily quota.
- Retired models (404) are skipped for 6 hours. Timed-out models are skipped for 2 minutes. An exhausted daily quota cools down for 1 hour.
- `GEMINI_AUTO_DISCOVER=true` tries up to two stable `gemini-X-flash[-lite]` models the key can see, but only after every configured model has failed. Preview, experimental and `-latest` aliases are never auto-used.
- Answers are cached per user/result/question (`ai_cache`, TTL `AI_CACHE_HOURS`). Failures are never cached and never replaced with fabricated content.
- The UI shows calm, non-technical messages, offers retry only when retrying can help, and keeps saved results visible.

### Visual work
- Editorial photo hero (CSS-only, reduced-motion aware) and glass login/register.
- Real Wikimedia Commons photographs for every catalog item: 89 local 640x800 photos plus the existing product photos. Attribution is on `/credits`, with data in `web/lib/photo-credits.json`.
- Masonry inspiration board, warm module backgrounds and clearer quizzes. Scoring is unchanged and pinned by `web/lib/questions.test.js`.
- Removed only: the styling catalog UI on result pages, and Face "Makeup color ideas".

### Verified (2026-10-29)
- `pytest` 140 passed; `py_compile` OK; ESLint 0 errors (1 existing warning in the colour camera page); Jest 85 passed; `next build` OK.
- Playwright journey on an isolated stack (Next 3055, Flask 5055, DB `matchmytone_e2e`, dropped afterwards): 60/60 checks.
- That run included live Gemini colour analysis (201 Deep Autumn, 8 s) with its PDF download, and a live AI stylist chat reply.

### Before hosting
- Set `RESEND_API_KEY` and `FROM_EMAIL`, or password-reset emails return a friendly "not configured" notice (503).
- Set a strong `JWT_SECRET_KEY`/`SECRET_KEY`, `MONGODB_URI` (Atlas), `FRONTEND_URL`, `CORS_ORIGINS`, and `MATCHMYTONE_API_BASE_URL` (must end in `/api`).
- OpenAI has no credit; leave `OPENAI_API_KEY` empty unless it is topped up.
- The free tier cannot guarantee unlimited requests. The app degrades gracefully, but heavy traffic needs a paid Gemini tier.

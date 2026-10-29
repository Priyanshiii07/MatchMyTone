# Deploying MatchMyTone: Vercel (website) + Render (API) + MongoDB Atlas + Resend

```
Browser ──HTTPS──► Vercel: Next.js website (web/)
                     │  the website's own server calls the API with the login token from an httpOnly cookie
                     ▼
                   Render: Flask API (backend/) ──► MongoDB Atlas
                                                 ──► Google Gemini (AI), Resend (email)
```

All secrets live **only on Render**. The browser never sees an API key, and Vercel only needs the API's URL.

| Piece | Where | Root directory | Build | Start | Health check |
|---|---|---|---|---|---|
| API | Render web service (Python) | `backend` | `pip install -r requirements.txt` | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 120` | `/api/health` |
| Website | Vercel project (Next.js) | `web` | `npm run build` (Vercel default) | managed by Vercel | — |

## 0. Before you start

- Accounts: GitHub, Render, Vercel, MongoDB Atlas, Resend, and Google AI Studio (for the Gemini key).
- **Rotate exposed keys first.** Older Gemini API keys and an old `backend/.env` were committed to this repository's history and pushed to GitHub. Deleting a file in a later commit does not remove it from history. In Google AI Studio / Google Cloud, delete every Gemini key that ever appeared in `backend/.env`, `app/ColorAnalysis/geminiConfig.js`, `src/ColorAnalysis/geminiConfig.js`, `reference/geminiConfig.js` or `COLOR_ANALYSIS_SETUP.md`. Do the same for any old OpenAI key and the old `SECRET_KEY`/`JWT_SECRET_KEY`. The keys in your current local `backend/.env` were checked: they do not appear in git history.
- Never commit `backend/.env` or `web/.env.local`; `.gitignore` already excludes them.

## 1. Push the code to GitHub

From `C:\Users\Admin\OneDrive\Desktop\MatchMyTone`:

```bash
git status                       # check that no .env file is listed
git add -A
git commit -m "[feat][<work-item-id>] Style cleanup, email verification, deployment config"
git remote add priyanshi https://github.com/Priyanshiii07/MatchMyTone.git   # only if that is not already your origin
git push -u priyanshi feature/style-personalization
```

Then open a pull request into `main` on GitHub and merge it there. Don't push straight to `main`. Render and Vercel will both deploy from `main`.

## 2. MongoDB Atlas

1. Create a project and a cluster (the free M0 tier works).
2. **Database Access:** create a user with a long random password.
3. **Network Access:** allow `0.0.0.0/0`, because Render's free tier has no fixed outbound IP. Rely on the strong password; paid Render plans can use static IPs instead.
4. **Connect → Drivers:** copy the `mongodb+srv://…` string and put your password in it. This becomes `MONGODB_URI`.

The API creates its collections and indexes on first start (`models.initialize_database()`):
- `users` with a unique email.
- `email_verification_tokens`: unique `token_hash`, `(user_id, used)`, and a TTL on `expires_at`.
- `password_reset_tokens`.
- `rate_limit_events`: `(key, created_at)` plus a TTL.
- The analysis, favourites and cache collections.

## 3. Resend (verification emails)

1. Sign up at resend.com.
2. **Domains → Add domain.** Use a domain you own; a subdomain such as `mail.yourdomain.com` is fine. Add the DNS records Resend shows (SPF `TXT`/`MX` and DKIM `TXT`; DMARC is recommended) at your DNS provider, and wait for **Verified**.
   - Without a verified domain you can only send from `onboarding@resend.dev`, and only to the email address of your own Resend account. Real users, including Gmail addresses, will **not** receive verification emails until the domain is verified.
3. **API Keys → Create** with "Sending access". This is `RESEND_API_KEY`.
4. Choose the sender, e.g. `MatchMyTone <noreply@mail.yourdomain.com>`. This is `FROM_EMAIL`, and its domain must be the verified one.

Creating an API key alone does not guarantee delivery to Gmail. Send yourself a real test after deployment (step 7).

## 4. Deploy the API on Render

**Render → New → Blueprint →** pick the GitHub repo. It reads `render.yaml`. Alternatively, use **New → Web Service** with the table above.

Set these environment variables. Values marked *secret* go only in Render's dashboard.

| Variable | Value |
|---|---|
| `PYTHON_VERSION` | `3.13.7` |
| `APP_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string *(secret)* |
| `MONGODB_DB` | `matchmytone` |
| `SECRET_KEY` | random, 32+ characters *(secret; the Blueprint generates it)* |
| `JWT_SECRET_KEY` | a **different** random value, 32+ characters *(secret; generated)* |
| `JWT_ACCESS_TOKEN_MINUTES` | `60` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` (production refuses to start with `false`) |
| `EMAIL_VERIFICATION_HOURS` | `24` |
| `FRONTEND_URL` | your Vercel URL, e.g. `https://matchmytone.vercel.app`, with no trailing slash |
| `BACKEND_URL` | this API's URL, e.g. `https://matchmytone-api.onrender.com` |
| `RESEND_API_KEY` | *(secret)* |
| `FROM_EMAIL` | `MatchMyTone <noreply@your-verified-domain>` |
| `GEMINI_API_KEY` | *(secret)* from Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.6-flash,gemini-3.1-flash-lite` |
| `GEMINI_TEXT_MODELS` | `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.6-flash` |
| `GEMINI_AUTO_DISCOVER` | `true` |
| `COLOR_ANALYSIS_MAX_SECONDS` | `55` (must stay below Vercel's 60 s function limit) |
| `AI_TEXT_MAX_SECONDS` | `45` |
| `OPENAI_API_KEY` | leave **empty** unless that OpenAI account has credit |

Generate secrets with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

In production the API **refuses to start** if any of the following holds:
- A secret is a placeholder or too short.
- `SECRET_KEY` and `JWT_SECRET_KEY` are equal.
- `MONGODB_URI` is local.
- `FLASK_DEBUG` is on.
- Email verification is off.

The log names the variable, never the value. `CORS_ORIGINS` defaults to `FRONTEND_URL`. It rarely matters, because the browser never calls the API directly.

You don't know the Vercel URL yet: put a placeholder in `FRONTEND_URL` now and fix it in step 6.

Check that `https://<api>.onrender.com/api/health` returns `"status": "ok"`.

## 5. Deploy the website on Vercel

1. **Vercel → Add New → Project →** import the GitHub repo.
2. **Root Directory:** `web`. The framework preset (Next.js) and the build/install commands are detected automatically.
3. **Environment Variables** (Production, and Preview if you use preview deployments):

   | Variable | Value |
   |---|---|
   | `MATCHMYTONE_API_BASE_URL` | `https://<api>.onrender.com/api` (**must end in `/api`**) |

   Nothing else is needed. Never add Gemini, Resend, MongoDB or JWT values to Vercel, and never put secrets in `NEXT_PUBLIC_*` variables.
4. **Settings → Functions:** Node.js 20.x or 22.x. The AI routes declare `maxDuration = 60`, which fits the Hobby plan.
5. Deploy. The site gets `https://<project>.vercel.app`, served over HTTPS, so the selfie camera works.

## 6. Connect the two

1. Copy the exact Vercel production URL (or your custom domain).
2. On Render, set `FRONTEND_URL` to it, with no trailing slash, and redeploy the API. Verification and password-reset emails link to `FRONTEND_URL/verify-email` and `FRONTEND_URL/reset-password`, so this must be the real website address.
3. If you later add a custom domain on Vercel, update `FRONTEND_URL` again.

## 7. Test the live site

1. **Register** with an address you can open, such as your Gmail. You should see "We've sent a verification link to your email. Please verify your email before logging in."
2. **Try to log in before verifying.** You should see "Please verify your email before logging in." plus a **Resend verification email** button.
3. **Open Gmail** and look for the email from your `FROM_EMAIL` (check Spam the first time). Click **Verify my email**. The website should show "Email verified." Opening the same link again should say the email is already verified.
4. **Log in**, use each analysis, reopen saved results, download PDFs, save to the Board, and try the AI stylist.
5. **Log out.** `/dashboard` should then redirect to `/login`.

Until step 3 succeeds with a real inbox, treat Gmail delivery as unverified.

## Existing accounts

Every account has `is_verified`. Accounts created before verification was enforced have `false` or no field, and are **not** auto-verified. At login they see "Please verify your email before logging in." with a resend button, and verify like a new user. If you deliberately import trusted development accounts into Atlas and want them active, set `is_verified: true` on those documents yourself and record why.

## Local development

- `backend/.env` (copy `backend/.env.example`): local MongoDB, any long secrets, `FRONTEND_URL=http://localhost:3000`. Locally you may set `REQUIRE_EMAIL_VERIFICATION=false` to skip verification; verification is on by default, and production refuses `false`.
- `web/.env.local` (copy `web/.env.example`): `MATCHMYTONE_API_BASE_URL=http://127.0.0.1:5000/api`.
- Run `python app.py` in `backend/` and `npm run dev` in `web/`.

**Testing verification locally without sending email:** `cd backend && python -m pytest test_security.py -q` runs the whole flow with a mocked Resend client.

**To try it by hand with real email:**
1. Set `REQUIRE_EMAIL_VERIFICATION=true` plus your Resend key and sender in `backend/.env`, with `FRONTEND_URL=http://localhost:3000`.
2. Register with your own address and click the link.

With Resend's test sender (`onboarding@resend.dev`), only your Resend account's address receives mail.

## Notes

- Render's free tier sleeps when idle. The first request after a pause can take about 50 seconds and may exceed Vercel's 60 s limit once, so retry or use a paid instance. AI requests are capped at 55 s so they stay inside Vercel's limit.
- Rate limits, counted in MongoDB:
  - Verification emails: 1 per minute and 5 per day per address.
  - Resend requests: 10 per hour per visitor.
  - Registrations: 10 per hour per visitor.
- `/api/test-email` exists only with `FLASK_DEBUG=true`, and returns 404 in production.

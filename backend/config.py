import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))


def _csv(value):
    return tuple(item.strip() for item in (value or "").split(",") if item.strip())


# Production is APP_ENV=production, or any Render service (Render sets RENDER=true).
PRODUCTION = (os.getenv("APP_ENV") or "").strip().lower() == "production" or (os.getenv("RENDER") or "").strip().lower() == "true"
MONGODB_URI = (os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017/matchmytone").strip()
MONGODB_DB = (os.getenv("MONGODB_DB") or "matchmytone").strip()
# Flask's SECRET_KEY and the JWT signing key are separate secrets; neither may reuse another credential.
SECRET_KEY = (os.getenv("SECRET_KEY") or "change-this-secret-key").strip()
JWT_SECRET_KEY = (os.getenv("JWT_SECRET_KEY") or "change-this-jwt-secret").strip()
JWT_ACCESS_TOKEN_MINUTES = max(5, int(os.getenv("JWT_ACCESS_TOKEN_MINUTES") or "60"))
TRUTHY = {"1", "true", "yes", "on"}
# Verification is on by default. Only local development may switch it off: in production it is always on,
# whatever REQUIRE_EMAIL_VERIFICATION says (app.py logs a warning if someone tried to disable it).
REQUIRE_EMAIL_VERIFICATION_SETTING = (os.getenv("REQUIRE_EMAIL_VERIFICATION") or "true").strip().lower() in TRUTHY
REQUIRE_EMAIL_VERIFICATION = REQUIRE_EMAIL_VERIFICATION_SETTING or PRODUCTION
EMAIL_VERIFICATION_HOURS = max(1, int(os.getenv("EMAIL_VERIFICATION_HOURS") or "24"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
BACKEND_URL = (os.getenv("BACKEND_URL", "http://127.0.0.1:5000") or "").strip().rstrip("/")
FRONTEND_URL = (os.getenv("FRONTEND_URL", "http://localhost:3000") or "").strip().rstrip("/")
# Browser origins allowed to call the API directly. The website itself calls Flask server-to-server through
# its Next.js proxy, so in production this only needs the deployed frontend URL.
CORS_ORIGINS = _csv(os.getenv("CORS_ORIGINS") or (FRONTEND_URL if PRODUCTION else "http://localhost:3000,http://127.0.0.1:3000"))
# Sender for every email, e.g. "MatchMyTone <noreply@mail.yourdomain.com>"; its domain must be verified in Resend.
FROM_EMAIL = (os.getenv("FROM_EMAIL") or "").strip()
RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
# Which service sends email: "resend" (default; needs a domain verified in Resend to reach other people) or
# "brevo" (a single verified sender address, such as a Gmail address, is enough while you have no domain).
EMAIL_PROVIDER = (os.getenv("EMAIL_PROVIDER") or "resend").strip().lower()
BREVO_API_KEY = (os.getenv("BREVO_API_KEY") or "").strip()
GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-3.5-flash").strip()
# Ordered Gemini models tried after GEMINI_MODEL; GEMINI_FALLBACK_MODEL is the older single-model setting.
GEMINI_FALLBACK_MODELS = _csv(os.getenv("GEMINI_FALLBACK_MODELS") or os.getenv("GEMINI_FALLBACK_MODEL") or "gemini-3.6-flash,gemini-3.1-flash-lite")
# Text-only features (stylist chat, looks, explanations) use their own chain so they never spend the
# selfie-analysis models' daily free-tier quota. Each Gemini model has a separate daily allowance.
GEMINI_TEXT_MODELS = _csv(os.getenv("GEMINI_TEXT_MODELS") or "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.6-flash")
# When every configured model is retired or unavailable, also try up to two stable Flash models the key can see.
GEMINI_AUTO_DISCOVER = (os.getenv("GEMINI_AUTO_DISCOVER") or "true").strip().lower() not in {"0", "false", "no", "off"}
GEMINI_API_VERSION = (os.getenv("GEMINI_API_VERSION") or "v1beta").strip()
GEMINI_THINKING_LEVEL = (os.getenv("GEMINI_THINKING_LEVEL", "low") or "").strip()
GEMINI_TIMEOUT_SECONDS = float(os.getenv("GEMINI_TIMEOUT_SECONDS") or "40")
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_VISION_MODEL = (os.getenv("OPENAI_VISION_MODEL") or "gpt-4.1-mini").strip()
OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS") or "30")
COLOR_ANALYSIS_MAX_SECONDS = float(os.getenv("COLOR_ANALYSIS_MAX_SECONDS") or "90")
# Text-only AI requests (recommendation explanations, trend search) share one bounded budget each.
AI_TEXT_MAX_SECONDS = float(os.getenv("AI_TEXT_MAX_SECONDS") or "45")
# Identical AI text requests (same user, context and question) reuse a stored answer for this long.
AI_CACHE_HOURS = max(1, int(os.getenv("AI_CACHE_HOURS") or "6"))
# Grounded trend highlights are re-searched at most once per topic within this window.
TREND_CACHE_DAYS = max(1, int(os.getenv("TREND_CACHE_DAYS") or "7"))


def email_problems():
    """Why verification emails can't be delivered with this configuration (variable names only, never values)."""
    problems = []
    if EMAIL_PROVIDER not in {"resend", "brevo"}:
        problems.append("EMAIL_PROVIDER must be resend or brevo.")
    elif EMAIL_PROVIDER == "brevo" and not BREVO_API_KEY:
        problems.append("BREVO_API_KEY is not set (EMAIL_PROVIDER=brevo).")
    elif EMAIL_PROVIDER == "resend" and not RESEND_API_KEY:
        problems.append("RESEND_API_KEY is not set.")
    if not FROM_EMAIL or "@" not in FROM_EMAIL:
        problems.append("FROM_EMAIL is not set (e.g. MatchMyTone <noreply@mail.yourdomain.com>).")
    elif FROM_EMAIL.rstrip(">").lower().endswith(("@example.com", "@example.org")):
        problems.append("FROM_EMAIL uses a placeholder address; use a sender verified with your email provider.")
    if PRODUCTION and (not FRONTEND_URL.startswith("https://") or "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL):
        problems.append("FRONTEND_URL must be the website's public https:// address (verification links point there).")
    return problems


PLACEHOLDER_SECRETS = {"change-this-secret-key", "change-this-jwt-secret", "replace-with-a-long-random-secret", "replace-with-a-different-long-random-secret"}


def production_problems():
    """Configuration that must never reach production. Messages name variables, never their values."""
    problems = []
    for name, value in (("SECRET_KEY", SECRET_KEY), ("JWT_SECRET_KEY", JWT_SECRET_KEY)):
        if value in PLACEHOLDER_SECRETS or len(value) < 32:
            problems.append(f"{name} must be a random secret of at least 32 characters.")
    if SECRET_KEY == JWT_SECRET_KEY:
        problems.append("SECRET_KEY and JWT_SECRET_KEY must be different secrets.")
    if JWT_SECRET_KEY in {GEMINI_API_KEY, OPENAI_API_KEY, RESEND_API_KEY, MONGODB_URI}:
        problems.append("JWT_SECRET_KEY must not reuse another credential.")
    if MONGODB_URI.startswith("mongodb://127.0.0.1") or MONGODB_URI.startswith("mongodb://localhost"):
        problems.append("MONGODB_URI points at a local database; use your MongoDB Atlas connection string.")
    if FLASK_DEBUG:
        problems.append("FLASK_DEBUG must be false in production.")
    return problems

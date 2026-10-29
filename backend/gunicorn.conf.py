"""Gunicorn settings, picked up automatically by `gunicorn app:app` when run from backend/ (as Render does).

One worker with threads: the duplicate-request guards and AI cooldowns live in process memory.
The 120 s timeout covers a full AI request (COLOR_ANALYSIS_MAX_SECONDS); Gunicorn's 30 s default would kill it.
"""

import os

bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
workers = 1
threads = int(os.getenv("GUNICORN_THREADS", "8"))
timeout = 120
graceful_timeout = 30
# Request lines can contain one-time tokens (old /api/auth/verify-email?token= links), so no access log.
accesslog = None
errorlog = "-"
loglevel = "info"

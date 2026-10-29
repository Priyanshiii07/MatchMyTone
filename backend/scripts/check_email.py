"""Check that verification emails can be delivered with the current configuration.

    python scripts/check_email.py                       # configuration + Resend domain status (sends nothing)
    python scripts/check_email.py --send-to you@gmail.com   # also sends ONE test email to that address

Run from backend/ (locally or in Render's Shell). Prints variable names and domain status, never key values.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def resend_get(path):
    request = Request(f"https://api.resend.com{path}", headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "MatchMyTone-email-check"})
    try:
        return json.loads(urlopen(request, timeout=20).read())
    except HTTPError as error:
        body = json.loads(error.read() or b"{}")
        raise SystemExit(f"Resend rejected the request (HTTP {error.code}): {body.get('message', '')}") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--send-to", help="send one real test email to this address")
    args = parser.parse_args()

    print(f"Production mode: {config.PRODUCTION}; verification required: {config.REQUIRE_EMAIL_VERIFICATION}")
    print(f"FRONTEND_URL: {config.FRONTEND_URL}  (links go to {config.FRONTEND_URL}/verify-email)")
    problems = config.email_problems()
    for problem in problems:
        print(f"  PROBLEM: {problem}")
    if not config.RESEND_API_KEY:
        raise SystemExit("Set RESEND_API_KEY first.")

    sender_domain = (re.search(r"@([^>\s]+)", config.FROM_EMAIL or "") or [None, ""])[1].lower()
    domains = resend_get("/domains").get("data", [])
    print(f"Resend domains on this key: {', '.join(f'{d['name']} ({d['status']})' for d in domains) or 'none'}")
    if sender_domain == "resend.dev":
        print("  NOTE: onboarding@resend.dev only delivers to the email address that owns the Resend account.")
    elif not any(d["name"].lower() == sender_domain and d["status"] == "verified" for d in domains):
        print(f"  PROBLEM: FROM_EMAIL's domain '{sender_domain or '?'}' is not a verified Resend domain; Resend will refuse to send to users.")

    if args.send_to:
        import resend
        resend.api_key = config.RESEND_API_KEY
        try:
            result = resend.Emails.send({"from": config.FROM_EMAIL, "to": [args.send_to], "subject": "MatchMyTone email test",
                                         "text": "This is a test from scripts/check_email.py. If you can read it, verification emails can reach this inbox."})
            print(f"Resend accepted the test email (id {result.get('id')}). Check the inbox and spam folder of {args.send_to}.")
        except Exception as error:  # report Resend's reason, e.g. an unverified domain
            raise SystemExit(f"Resend refused the test email: {getattr(error, 'message', error)}") from None


if __name__ == "__main__":
    main()

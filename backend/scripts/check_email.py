"""Check that verification emails can be delivered with the current configuration.

    python scripts/check_email.py                           # configuration + provider sender status (sends nothing)
    python scripts/check_email.py --send-to you@gmail.com   # also sends ONE test email to that address

Run from backend/ (locally or in Render's Shell). Prints variable names and sender status, never key values.
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


def get_json(url, headers):
    try:
        return json.loads(urlopen(Request(url, headers={**headers, "User-Agent": "MatchMyTone-email-check", "Accept": "application/json"}), timeout=20).read())
    except HTTPError as error:
        body = json.loads(error.read() or b"{}")
        raise SystemExit(f"The provider rejected the request (HTTP {error.code}): {body.get('message', '')}") from None


def sender_address():
    match = re.search(r"<([^>]+)>", config.FROM_EMAIL or "")
    return (match.group(1) if match else (config.FROM_EMAIL or "")).strip().lower()


def check_resend(address):
    domains = get_json("https://api.resend.com/domains", {"Authorization": f"Bearer {config.RESEND_API_KEY}"}).get("data", [])
    print(f"Resend domains on this key: {', '.join(f'{d['name']} ({d['status']})' for d in domains) or 'none'}")
    domain = address.split("@")[-1]
    if domain == "resend.dev":
        print("  NOTE: onboarding@resend.dev only delivers to the email address that owns the Resend account.")
    elif not any(d["name"].lower() == domain and d["status"] == "verified" for d in domains):
        print(f"  PROBLEM: '{domain}' is not a verified Resend domain, so Resend will refuse to email your users.")
        print("           Without a domain, use EMAIL_PROVIDER=brevo (see DEPLOYMENT.md).")


def check_brevo(address):
    senders = get_json("https://api.brevo.com/v3/senders", {"api-key": config.BREVO_API_KEY}).get("senders", [])
    print(f"Brevo senders on this key: {', '.join(f'{s['email']} ({'active' if s.get('active') else 'not verified'})' for s in senders) or 'none'}")
    if not any(s["email"].lower() == address and s.get("active") for s in senders):
        print(f"  PROBLEM: {address or 'FROM_EMAIL'} is not a verified, active Brevo sender. Add it under Senders, Domains & Dedicated IPs → Senders.")


def send_test(address_to):
    if config.EMAIL_PROVIDER == "brevo":
        name = (re.match(r"\s*(.*?)\s*<", config.FROM_EMAIL or "") or [None, "MatchMyTone"])[1] or "MatchMyTone"
        body = {"sender": {"name": name, "email": sender_address()}, "to": [{"email": address_to}], "subject": "MatchMyTone email test",
                "textContent": "This is a test from scripts/check_email.py. If you can read it, verification emails can reach this inbox."}
        request = Request("https://api.brevo.com/v3/smtp/email", data=json.dumps(body).encode(), method="POST",
                          headers={"api-key": config.BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json"})
        try:
            result = json.loads(urlopen(request, timeout=20).read() or b"{}")
        except HTTPError as error:
            raise SystemExit(f"Brevo refused the test email: {json.loads(error.read() or b'{}').get('message', error.code)}") from None
        print(f"Brevo accepted the test email (id {result.get('messageId')}).")
    else:
        import resend
        resend.api_key = config.RESEND_API_KEY
        try:
            result = resend.Emails.send({"from": config.FROM_EMAIL, "to": [address_to], "subject": "MatchMyTone email test",
                                         "text": "This is a test from scripts/check_email.py. If you can read it, verification emails can reach this inbox."})
        except Exception as error:  # report the provider's reason, e.g. an unverified domain
            raise SystemExit(f"Resend refused the test email: {getattr(error, 'message', error)}") from None
        print(f"Resend accepted the test email (id {result.get('id')}).")
    print(f"Check the inbox and spam folder of {address_to}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--send-to", help="send one real test email to this address")
    args = parser.parse_args()

    print(f"Provider: {config.EMAIL_PROVIDER}; production: {config.PRODUCTION}; verification required: {config.REQUIRE_EMAIL_VERIFICATION}")
    print(f"FRONTEND_URL: {config.FRONTEND_URL}  (links go to {config.FRONTEND_URL}/verify-email)")
    problems = config.email_problems()
    for problem in problems:
        print(f"  PROBLEM: {problem}")
    if any("API_KEY" in problem or "EMAIL_PROVIDER" in problem for problem in problems):
        raise SystemExit("Fix the problems above first.")
    (check_brevo if config.EMAIL_PROVIDER == "brevo" else check_resend)(sender_address())
    if args.send_to:
        send_test(args.send_to)


if __name__ == "__main__":
    main()

"""Email verification, JWT validation, per-user ownership and production-configuration checks.

Email is never sent: Resend is replaced by a recorder. Tokens are read from the recorded message only.
"""

import re
import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

import app
import config
from models import analysis_collections, email_verifications, rate_events, style_favorites, users, utc_now

PASSWORD = "ValidPass!123"
BODY_ANSWERS = {f"Q{i}": {"label": "A", "shapes": ["Pear"]} for i in range(1, 10)}


@pytest.fixture
def outbox(monkeypatch):
    """Resend configured, but every message is captured instead of sent."""
    sent = []
    monkeypatch.setattr(app.resend, "api_key", "re_test")
    monkeypatch.setattr(app.resend.Emails, "send", lambda message: sent.append(message))
    return sent


@pytest.fixture
def require_verification(monkeypatch):
    monkeypatch.setattr(config, "REQUIRE_EMAIL_VERIFICATION", True)


def register(client, email=None):
    suffix = uuid.uuid4().hex[:10]
    details = {"name": f"Sec {suffix}", "email": email or f"sec.{suffix}@example.com", "password": PASSWORD, "dob": "1995-05-05", "age": 31}
    response = client.post("/api/auth/register", json=details)
    assert response.status_code == 201, response.get_json()
    return details, response.get_json()


def token_from(message):
    return re.search(r"/verify-email#token=([A-Za-z0-9_-]+)", message["text"]).group(1)


def login(client, details):
    return client.post("/api/auth/login", json={"email": details["email"], "password": PASSWORD})


def cool_down(user_id=None):
    """Pretend the per-email cooldown has passed (rate events and tokens moved 5 minutes into the past)."""
    past = utc_now() - timedelta(minutes=5)
    rate_events.update_many({}, {"$set": {"created_at": past}})
    if user_id:
        email_verifications.update_many({"user_id": user_id}, {"$set": {"created_at": past}})


# ---------- email verification ----------

def test_registration_creates_an_unverified_account_and_requests_a_resend_email(client, outbox, require_verification):
    # Arrange / Act
    details, body = register(client)
    # Assert (1, 2): unverified account, hashed password, one Resend message to the exact address entered.
    stored = users.find_one({"email": details["email"]})
    assert stored["is_verified"] is False and stored["password_hash"].startswith("$2") and PASSWORD not in str(stored)
    assert body["verification_email_sent"] is True and body["requires_verification"] is True
    assert body["message"] == "We've sent a verification link to your email. Please verify your email before logging in."
    assert len(outbox) == 1 and outbox[0]["to"] == [details["email"]]
    assert "Verify my email" in outbox[0]["html"] and "expires in" in outbox[0]["text"] and "didn't create" in outbox[0]["text"]
    # The link opens the website; the token sits in the URL fragment, which is never sent to or logged by a server.
    assert outbox[0]["text"].startswith(f"Welcome to MatchMyTone! Verify your email here: {config.FRONTEND_URL}/verify-email#token=")
    token = token_from(outbox[0])
    record = email_verifications.find_one({"user_id": body["user"]["id"]})
    assert record["token_hash"] == app.token_hash(token) and token not in str(record)
    assert len(token) >= 40 and app._aware(record["expires_at"], utc_now()) > utc_now()


def test_only_verified_accounts_can_log_in_or_use_the_api(client, outbox, require_verification, monkeypatch):
    details, body = register(client)
    token = token_from(outbox[0])
    # (7) No JWT for an unverified account.
    blocked = login(client, details)
    assert blocked.status_code == 403 and blocked.get_json()["errorCode"] == "email_not_verified"
    assert "token" not in str(blocked.get_json())
    # A token issued while verification was off can't be used either.
    with app.app.app_context():
        early = create_access_token(identity=body["user"]["id"])
    refused = client.get("/api/users/profile", headers={"Authorization": f"Bearer {early}"})
    assert refused.status_code == 403 and refused.get_json()["errorCode"] == "email_not_verified"
    assert client.get("/api/quiz/results", headers={"Authorization": f"Bearer {early}"}).status_code == 403
    # (3) A valid token verifies exactly this account. Old GET links hand the token over without consuming it.
    redirect = client.get(f"/api/auth/verify-email?token={token}")
    assert redirect.status_code == 302 and redirect.headers["Location"].endswith(f"/verify-email#token={token}")
    verified = client.post("/api/auth/verify-email", json={"token": token})
    assert verified.status_code == 200 and verified.get_json()["status"] == "verified"
    assert users.find_one({"id": body["user"]["id"]})["is_verified"] is True
    # (6) Reuse is refused; the user is told they're already verified.
    again = client.post("/api/auth/verify-email", json={"token": token})
    assert again.status_code == 200 and again.get_json()["status"] == "already_verified"
    # (8, 12) Normal login, JWT and protected routes afterwards.
    ok = login(client, details)
    assert ok.status_code == 200
    headers = {"Authorization": f"Bearer {ok.get_json()['user']['token']}"}
    assert client.get("/api/users/profile", headers=headers).get_json()["user"]["is_verified"] is True
    assert client.get("/api/users/profile", headers={"Authorization": f"Bearer {early}"}).status_code == 200


def test_invalid_expired_and_used_tokens_are_rejected(client, outbox):
    _, body = register(client)
    user_id = body["user"]["id"]
    # (4) Invalid.
    for bad in ("", "short", "not a token!!", "x" * 300, uuid.uuid4().hex + "zz"):
        response = client.post("/api/auth/verify-email", json={"token": bad})
        assert response.status_code == 400 and response.get_json()["errorCode"] == "invalid_token"
    # (5) Expired.
    expired = "expired" + uuid.uuid4().hex
    email_verifications.insert_one({"token_hash": app.token_hash(expired), "user_id": user_id, "email": body["user"]["email"], "used": False, "created_at": utc_now(), "expires_at": utc_now() - timedelta(minutes=5)})
    response = client.post("/api/auth/verify-email", json={"token": expired})
    assert response.status_code == 410 and response.get_json()["errorCode"] == "token_expired"
    # (6) Used while the account is still unverified.
    used = "used" + uuid.uuid4().hex
    email_verifications.insert_one({"token_hash": app.token_hash(used), "user_id": user_id, "email": body["user"]["email"], "used": True, "created_at": utc_now(), "expires_at": utc_now() + timedelta(hours=1)})
    response = client.post("/api/auth/verify-email", json={"token": used})
    assert response.status_code == 409 and response.get_json()["errorCode"] == "token_used"
    assert users.find_one({"id": user_id})["is_verified"] is False


def test_a_token_cannot_verify_a_different_or_changed_address(client, outbox):
    _, first = register(client)
    _, second = register(client)
    token = token_from(outbox[0])
    client.post("/api/auth/verify-email", json={"token": token, "email": second["user"]["email"], "user_id": second["user"]["id"]})
    assert users.find_one({"id": first["user"]["id"]})["is_verified"] is True
    assert users.find_one({"id": second["user"]["id"]})["is_verified"] is False
    second_token = token_from(outbox[1])
    users.update_one({"id": second["user"]["id"]}, {"$set": {"email": f"changed.{uuid.uuid4().hex[:6]}@example.com"}})
    assert client.post("/api/auth/verify-email", json={"token": second_token}).get_json()["errorCode"] == "invalid_token"
    assert users.find_one({"id": second["user"]["id"]})["is_verified"] is False


def test_resend_issues_a_fresh_token_and_retires_the_old_link(client, outbox, require_verification):
    # (9)
    details, body = register(client)
    old = token_from(outbox[0])
    cool_down(body["user"]["id"])
    response = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    assert response.status_code == 200 and len(outbox) == 2
    new = token_from(outbox[1])
    assert new != old
    superseded = client.post("/api/auth/verify-email", json={"token": old})
    assert superseded.status_code == 409 and superseded.get_json()["errorCode"] == "token_superseded"
    assert client.post("/api/auth/verify-email", json={"token": new}).get_json()["status"] == "verified"
    # Already verified: the same neutral answer and no email.
    cool_down()
    after = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    assert after.status_code == 200 and len(outbox) == 2


def test_resend_never_reveals_whether_an_account_exists(client, outbox):
    details, body = register(client)
    cool_down(body["user"]["id"])
    unknown = "nobody." + uuid.uuid4().hex[:6] + "@example.com"
    known_answer = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    unknown_answer = client.post("/api/auth/resend-verification", json={"email": unknown})
    assert (known_answer.status_code, known_answer.get_json()) == (unknown_answer.status_code, unknown_answer.get_json()) == (200, known_answer.get_json())
    # (10) The per-email cooldown applies to every address, registered or not.
    assert client.post("/api/auth/resend-verification", json={"email": details["email"]}).status_code == 429
    limited = client.post("/api/auth/resend-verification", json={"email": unknown})
    assert limited.status_code == 429 and int(limited.headers["Retry-After"]) > 0
    assert client.post("/api/auth/resend-verification", json={"email": "not-an-email"}).status_code == 400


def test_rate_limits_cap_daily_emails_and_requests_per_address(client, outbox):
    # (10) At most five verification emails a day per address, and ten resend requests an hour per client.
    details, body = register(client)
    for _ in range(4):
        cool_down(body["user"]["id"])
        assert client.post("/api/auth/resend-verification", json={"email": details["email"]}).status_code == 200
    cool_down(body["user"]["id"])
    assert client.post("/api/auth/resend-verification", json={"email": details["email"]}).status_code == 429
    assert len(outbox) == 5
    rate_events.delete_many({})
    for index in range(10):
        client.post("/api/auth/resend-verification", json={"email": f"spray{index}@example.com"})
    assert client.post("/api/auth/resend-verification", json={"email": "spray-last@example.com"}).status_code == 429
    # Registrations per client address.
    rate_events.delete_many({})
    for _ in range(10):
        register(client)
    blocked = client.post("/api/auth/register", json={"name": "Late " + uuid.uuid4().hex[:6], "email": f"late.{uuid.uuid4().hex[:6]}@example.com", "password": PASSWORD})
    assert blocked.status_code == 429 and blocked.get_json()["errorCode"] == "rate_limited"


def test_resend_failures_are_reported_and_keep_the_account_and_old_link(client, outbox, monkeypatch, require_verification):
    # (11)
    details, body = register(client)
    old = token_from(outbox[0])
    cool_down(body["user"]["id"])

    def reject(message):
        raise RuntimeError("provider rejected")

    monkeypatch.setattr(app.resend.Emails, "send", reject)
    failed = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    assert failed.status_code == 502 and failed.get_json()["errorCode"] == "email_failed"
    assert users.find_one({"id": body["user"]["id"]}) is not None
    # The undelivered token is dead, but the earlier link the user already has still works.
    assert email_verifications.count_documents({"user_id": body["user"]["id"], "undeliverable": True}) == 1
    assert client.post("/api/auth/verify-email", json={"token": old}).get_json()["status"] == "verified"


def test_registration_reports_a_failed_email_honestly(client, monkeypatch, require_verification):
    monkeypatch.setattr(app.resend, "api_key", "re_test")

    def reject(message):
        raise RuntimeError("provider rejected")

    monkeypatch.setattr(app.resend.Emails, "send", reject)
    details, body = register(client)
    assert body["verification_email_sent"] is False and "couldn't send" in body["message"]
    assert users.find_one({"email": details["email"]})["is_verified"] is False
    assert login(client, details).status_code == 403


def test_without_resend_nothing_pretends_to_be_sent(client, require_verification):
    details, body = register(client)
    assert body["verification_email_sent"] is False and "couldn't send" in body["message"]
    response = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    assert response.status_code == 503 and response.get_json()["errorCode"] == "email_not_configured"


def test_existing_accounts_without_a_verified_flag_must_verify(client, outbox, require_verification):
    # Accounts created before verification existed may lack the field: they are treated as unverified, never auto-verified.
    details, body = register(client)
    users.update_one({"id": body["user"]["id"]}, {"$unset": {"is_verified": ""}})
    assert login(client, details).status_code == 403
    cool_down(body["user"]["id"])
    assert client.post("/api/auth/resend-verification", json={"email": details["email"]}).status_code == 200
    assert client.post("/api/auth/verify-email", json={"token": token_from(outbox[-1])}).get_json()["status"] == "verified"
    assert login(client, details).status_code == 200


# ---------- JWT ----------

def test_protected_endpoints_reject_missing_tampered_foreign_and_expired_tokens(client, make_user):
    headers, user = make_user()
    good = headers["Authorization"].split()[1]
    head, payload, signature = good.split(".")
    tampered = f"{head}.{payload}.{signature[:-4]}AAAA"
    import jwt as pyjwt
    foreign = pyjwt.encode({"sub": user["id"], "type": "access", "fresh": False, "jti": "x", "nbf": 0, "iat": 0, "exp": 9999999999}, "a-different-secret-entirely-0123456789", algorithm="HS256")
    with app.app.app_context():
        expired = create_access_token(identity=user["id"], expires_delta=timedelta(seconds=-5))
    assert client.get("/api/users/profile").status_code == 401
    for token in (tampered, foreign, "not-a-jwt"):
        assert client.get("/api/users/profile", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    response = client.get("/api/users/profile", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401 and response.get_json()["errorCode"] == "session_expired"
    assert client.get("/api/users/profile", headers=headers).status_code == 200
    assert app.app.config["JWT_SECRET_KEY"] == config.JWT_SECRET_KEY != config.SECRET_KEY


def test_debug_only_email_diagnostics_are_hidden(client):
    assert client.get("/api/test-email").status_code == 404


# ---------- ownership ----------

def test_users_cannot_read_or_change_each_others_data(client, make_user):
    owner_headers, owner = make_user()
    other_headers, _ = make_user()
    saved = client.post("/api/quiz/body-shape", headers=owner_headers, json={"answers": BODY_ANSWERS, "result": "Pear"}).get_json()["result"]
    rid = saved["id"]
    item = saved["styling"]["items"][0]["id"]
    assert client.post("/api/favorites", headers=owner_headers, json={"item_id": item, "result_id": rid}).status_code == 201
    before = analysis_collections["body_shape"].find_one({"id": rid}, {"_id": 0})
    attempts = [
        client.get(f"/api/quiz/body-shape/{rid}", headers=other_headers),
        client.get(f"/api/quiz/body-shape/{rid}/pdf", headers=other_headers),
        client.get(f"/api/quiz/body-shape/{rid}/trends", headers=other_headers),
        client.put(f"/api/quiz/body-shape/{rid}/progress", headers=other_headers, json={"checklist": {"x": True}}),
        client.put(f"/api/quiz/body-shape/{rid}/styling", headers=other_headers, json={"catalog": "womenswear"}),
        client.post(f"/api/quiz/body-shape/{rid}/insights", headers=other_headers, json={}),
    ]
    assert all(response.status_code in (403, 404) for response in attempts), [response.status_code for response in attempts]
    assert analysis_collections["body_shape"].find_one({"id": rid}, {"_id": 0}) == before
    assert client.get("/api/favorites", headers=other_headers).get_json()["favorites"] == []
    client.delete(f"/api/favorites/{item}", headers=other_headers)
    assert style_favorites.count_documents({"user_id": owner["id"], "item_id": item}) == 1
    # A user id in the body is never trusted over the token.
    client.put("/api/users/profile", headers=other_headers, json={"id": owner["id"], "phone": "9000000001"})
    assert users.find_one({"id": owner["id"]}).get("phone") != "9000000001"
    assert [doc["id"] for doc in client.get("/api/quiz/body-shape", headers=other_headers).get_json().get("results", [])] == []


def test_legacy_beard_favorites_stay_stored_but_are_not_shown(client, make_user):
    headers, user = make_user()
    style_favorites.insert_one({"user_id": user["id"], "kind": "style", "module": "face", "item_id": "beard-full", "title": "Full beard", "category": "beard", "art": "beard", "created_at": utc_now()})
    assert client.get("/api/favorites", headers=headers).get_json()["favorites"] == []
    assert style_favorites.count_documents({"user_id": user["id"], "item_id": "beard-full"}) == 1
    assert client.post("/api/favorites", headers=headers, json={"item_id": "beard-full"}).status_code == 400


# ---------- production configuration ----------

def test_production_refuses_placeholder_secrets_and_local_databases(monkeypatch):
    monkeypatch.setattr(config, "SECRET_KEY", "change-this-secret-key")
    monkeypatch.setattr(config, "JWT_SECRET_KEY", "change-this-jwt-secret")
    monkeypatch.setattr(config, "MONGODB_URI", "mongodb://127.0.0.1:27017/matchmytone")
    problems = " ".join(config.production_problems())
    assert "SECRET_KEY" in problems and "JWT_SECRET_KEY" in problems and "MONGODB_URI" in problems
    strong_a, strong_b = "a" * 48, "b" * 48
    monkeypatch.setattr(config, "SECRET_KEY", strong_a)
    monkeypatch.setattr(config, "JWT_SECRET_KEY", strong_a)
    assert any("different" in problem for problem in config.production_problems())
    monkeypatch.setattr(config, "JWT_SECRET_KEY", strong_b)
    monkeypatch.setattr(config, "MONGODB_URI", "mongodb+srv://cluster.example.mongodb.net/matchmytone")
    monkeypatch.setattr(config, "FLASK_DEBUG", False)
    assert config.production_problems() == []
    # Messages name variables, never values.
    assert strong_a not in " ".join(problems)


def _config_in_subprocess(env, expression):
    import json
    import os
    import subprocess
    import sys
    clean = {k: v for k, v in os.environ.items() if k not in {"APP_ENV", "RENDER", "REQUIRE_EMAIL_VERIFICATION", "FROM_EMAIL", "FRONTEND_URL", "RESEND_API_KEY"}}
    code = f"import json, config; print(json.dumps({expression}))"
    out = subprocess.run([sys.executable, "-c", code], env={**clean, **env}, capture_output=True, text=True, cwd=os.path.dirname(__file__), check=True)
    return json.loads(out.stdout.strip().splitlines()[-1])


def test_production_always_requires_verification_even_if_switched_off():
    # Render sets RENDER=true; a copied local REQUIRE_EMAIL_VERIFICATION=false must not disable verification there.
    assert _config_in_subprocess({"RENDER": "true", "REQUIRE_EMAIL_VERIFICATION": "false"}, "config.REQUIRE_EMAIL_VERIFICATION") is True
    assert _config_in_subprocess({"APP_ENV": "production", "REQUIRE_EMAIL_VERIFICATION": "False "}, "config.REQUIRE_EMAIL_VERIFICATION") is True
    assert _config_in_subprocess({"REQUIRE_EMAIL_VERIFICATION": "false"}, "config.REQUIRE_EMAIL_VERIFICATION") is False


def test_email_configuration_problems_are_named_without_values():
    problems = _config_in_subprocess({"RENDER": "true", "RESEND_API_KEY": "not-a-real-key-SENTINEL", "FROM_EMAIL": "MatchMyTone <noreply@example.com>", "FRONTEND_URL": "http://localhost:3000"}, "config.email_problems()")
    text = " ".join(problems)
    assert "FROM_EMAIL" in text and "FRONTEND_URL" in text and "not-a-real-key-SENTINEL" not in text
    good = _config_in_subprocess({"RENDER": "true", "RESEND_API_KEY": "re_x", "FROM_EMAIL": "MatchMyTone <noreply@mail.matchmytone.test>", "FRONTEND_URL": "https://matchmytone.vercel.app"}, "config.email_problems()")
    assert good == []


def test_misconfigured_sender_is_reported_not_faked(client, monkeypatch):
    monkeypatch.setattr(app.resend, "api_key", "re_test")
    monkeypatch.setattr(config, "FROM_EMAIL", "MatchMyTone <noreply@example.com>")
    sent = []
    monkeypatch.setattr(app.resend.Emails, "send", lambda message: sent.append(message))
    details, body = register(client)
    assert body["verification_email_sent"] is False and sent == []
    response = client.post("/api/auth/resend-verification", json={"email": details["email"]})
    assert response.status_code == 503 and response.get_json()["errorCode"] == "email_not_configured"

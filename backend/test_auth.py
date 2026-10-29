import unittest
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from flask_jwt_extended import create_access_token

import app
from models import analysis_collections, password_resets, users, utc_now


class AuthBoundaryTests(unittest.TestCase):
    def test_password_policy_is_authoritative(self):
        self.assertIsNone(app.validate_password("ValidPass!123"))
        for value in ("short", "lowercase1!", "UPPERCASE1!", "NoNumber!", "NoSpecial123"):
            self.assertIsNotNone(app.validate_password(value))

    def test_protected_endpoints_reject_anonymous_requests(self):
        client = app.app.test_client()
        for path in ("/api/users/profile", "/api/quiz/results", "/api/analyze/color"):
            response = client.get(path) if path.endswith("results") or path.endswith("profile") else client.post(path, json={})
            self.assertEqual(response.status_code, 401, path)

    def test_registration_rejects_whitespace_and_weak_password_before_database_access(self):
        client = app.app.test_client()
        response = client.post("/api/auth/register", json={"name": "   ", "email": "bad@example.com", "password": "weak"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Name is required", response.get_json()["error"])

    def test_analysis_save_is_idempotent_for_same_request(self):
        collection = MagicMock()
        collection.find_one.side_effect = [None, {"id": "saved", "user_id": "u1", "request_id": "r1", "answers": {}}]
        with app.app.test_request_context("/api/quiz/skincare", method="POST", json={"request_id": "r1", "answers": {"q1": {"label": "A"}}, "result": "Oily Skin"}), patch.object(app, "current_user", return_value={"id": "u1"}), patch.dict(app.analysis_collections, {"skincare": collection}), patch.object(app, "new_id", return_value="new"), patch.object(app, "utc_now", return_value="now"):
            first = app.save_analysis("skincare")
            second = app.save_analysis("skincare")
        self.assertEqual(first[1], 201)
        self.assertEqual(second[1], 200)
        collection.insert_one.assert_called_once()


def test_registration_normalizes_email_and_blocks_case_variant_duplicates(client):
    details = {"name": "Case Tester", "email": "  Case.Tester@Example.COM ", "password": "ValidPass!123"}
    created = client.post("/api/auth/register", json=details)
    assert created.status_code == 201 and created.get_json()["user"]["email"] == "case.tester@example.com"
    assert "password_hash" not in str(created.get_json())
    assert users.find_one({"email": "case.tester@example.com"})["password_hash"].startswith("$2")
    duplicate = client.post("/api/auth/register", json={**details, "name": "Someone Else", "email": "CASE.TESTER@example.com"})
    assert duplicate.status_code == 409


def test_login_accepts_valid_and_rejects_invalid_credentials(client, make_user):
    _, user = make_user()
    assert client.post("/api/auth/login", json={"email": user["email"].upper(), "password": "ValidPass!123"}).status_code == 200
    wrong = client.post("/api/auth/login", json={"email": user["email"], "password": "WrongPass!123"})
    assert wrong.status_code == 401 and wrong.get_json()["error"] == "Invalid email or password."
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "ValidPass!123"}).status_code == 401


def test_malformed_and_expired_tokens_are_rejected_with_401(client, make_user):
    _, user = make_user()
    assert client.get("/api/users/profile", headers={"Authorization": "Bearer garbage"}).status_code == 401
    with app.app.app_context():
        expired = create_access_token(identity=user["id"], expires_delta=timedelta(seconds=-5))
    response = client.get("/api/users/profile", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401 and response.get_json()["errorCode"] == "session_expired"


def test_profile_update_persists(client, make_user):
    headers, _ = make_user()
    response = client.put("/api/users/profile", headers=headers, json={"phone": "9876501234", "gender": "female", "dob": "1990-02-03", "age": 36})
    assert response.status_code == 200
    profile = client.get("/api/users/profile", headers=headers).get_json()["user"]
    assert (profile["phone"], profile["gender"], profile["dob"]) == ("9876501234", "female", "1990-02-03")


def test_saved_result_cannot_be_written_into_or_read_from_another_account(client, make_user):
    owner_headers, owner = make_user()
    attacker_headers, attacker = make_user()
    payload = {"answers": {"1": {"label": "A"}}, "result": "Oily Skin", "user_id": owner["id"], "id": "chosen-id"}
    saved = client.post("/api/quiz/skincare", headers=attacker_headers, json=payload)
    assert saved.status_code == 201
    document = analysis_collections["skincare"].find_one({"id": saved.get_json()["result"]["id"]})
    assert document["user_id"] == attacker["id"] and document["id"] != "chosen-id"
    owner_saved = client.post("/api/quiz/body-shape", headers=owner_headers, json={"answers": {"Q1": {"label": "A"}}, "result": "Pear"}).get_json()["result"]["id"]
    assert client.get(f"/api/quiz/body-shape/{owner_saved}", headers=attacker_headers).status_code == 404
    assert client.get(f"/api/quiz/body-shape/{owner_saved}/pdf", headers=attacker_headers).status_code == 404
    assert client.get(f"/api/quiz/body-shape/{owner_saved}", headers=owner_headers).status_code == 200
    assert not client.get("/api/quiz/results", headers=attacker_headers).get_json()["results"]["body_shape"]


@pytest.mark.parametrize("kind,payload", [
    ("skincare", {"answers": {"1": {"label": "A"}}, "result": "Glowing Skin"}),
    ("body-shape", {"answers": {}, "result": "Pear"}),
    ("face-shape", {"answers": {"Q1": {"label": "A"}}, "result": "Triangle"}),
])
def test_quiz_results_are_validated(client, make_user, kind, payload):
    headers, _ = make_user()
    assert client.post(f"/api/quiz/{kind}", headers=headers, json=payload).status_code == 400


def test_password_reset_request_reports_missing_email_provider(client, make_user):
    _, user = make_user()
    response = client.post("/api/auth/request-password-reset", json={"email": user["email"]})
    assert response.status_code == 503 and response.get_json()["errorCode"] == "email_not_configured"
    assert password_resets.count_documents({"user_id": user["id"]}) == 0


def test_password_reset_request_sends_email_when_configured(client, make_user, monkeypatch):
    _, user = make_user()
    sent = []
    monkeypatch.setattr(app.resend, "api_key", "re_test")
    monkeypatch.setattr(app.resend.Emails, "send", lambda message: sent.append(message))
    response = client.post("/api/auth/request-password-reset", json={"email": user["email"]})
    assert response.status_code == 200 and len(sent) == 1 and "/reset-password?token=" in sent[0]["text"]
    unknown = client.post("/api/auth/request-password-reset", json={"email": "nobody@example.com"})
    assert unknown.status_code == 200 and len(sent) == 1


def test_password_reset_token_is_single_use_and_expires(client, make_user):
    _, user = make_user()
    password_resets.insert_one({"token_hash": app.token_hash("good-token"), "user_id": user["id"], "used": False, "created_at": utc_now(), "expires_at": utc_now() + timedelta(hours=1)})
    password_resets.insert_one({"token_hash": app.token_hash("old-token"), "user_id": user["id"], "used": False, "created_at": utc_now(), "expires_at": utc_now() - timedelta(minutes=1)})
    assert client.post("/api/auth/reset-password", json={"token": "good-token", "password": "weak"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": "good-token", "password": "NewValid!456"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": "good-token", "password": "Another!789"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": "old-token", "password": "Another!789"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "NewValid!456"}).status_code == 200


if __name__ == "__main__":
    unittest.main()

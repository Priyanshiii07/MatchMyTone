"""Color analysis API tests against the isolated test database with a mocked provider chain."""

import base64

import pytest
from pymongo.errors import ServerSelectionTimeoutError

import app
import color_providers
from color_providers import ProviderError
from models import analysis_collections


JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 300).decode()
RESULT = {
    "isFace": True, "description": "", "detectedGender": "female", "seasonType": "Deep Autumn", "seasonDescription": "Rich and warm.",
    "undertone": "Warm", "undertoneDescription": "Golden.", "skinAge": 32, "skinAgeDescription": "Estimate.",
    "colorsToWear": [{"name": f"Wear {i}", "hex": "#C2593F"} for i in range(6)],
    "colorsToAvoid": [{"name": f"Avoid {i}", "hex": "#E6E6FA"} for i in range(3)],
}


@pytest.fixture
def provider(monkeypatch):
    calls = []

    def fake(image, mime_type, previous=None, profile=None):
        calls.append(image)
        outcome = fake.outcome
        if isinstance(outcome, Exception):
            raise outcome
        return outcome, "gemini", "gemini-primary", []

    fake.outcome = dict(RESULT)
    fake.calls = calls
    monkeypatch.setattr(color_providers, "analyze_color", fake)
    return fake


def analyze(client, headers, request_id="req-1", image=JPEG, mime="image/jpeg"):
    return client.post("/api/analyze/color", headers=headers, json={"image": image, "mimeType": mime, "request_id": request_id})


def test_requires_authentication(client, provider):
    assert client.post("/api/analyze/color", json={"image": JPEG}).status_code == 401
    assert client.post("/api/analyze/color", headers={"Authorization": "Bearer not-a-token"}, json={"image": JPEG}).status_code == 401
    assert provider.calls == []


@pytest.mark.parametrize("image,mime", [("short", "image/jpeg"), ("!" * 200, "image/jpeg"), (base64.b64encode(b"GIF89a" + b"\x00" * 200).decode(), "image/jpeg"), (JPEG, "image/gif")])
def test_rejects_invalid_images_before_calling_providers(client, make_user, provider, image, mime):
    headers, _ = make_user()
    response = analyze(client, headers, image=image, mime=mime)
    assert response.status_code == 400 and response.get_json()["errorCode"] == "invalid_image"
    assert provider.calls == []


def test_success_is_persisted_for_owner_only(client, make_user, provider):
    headers, user = make_user(gender="female")
    response = analyze(client, headers)
    assert response.status_code == 201
    body = response.get_json()
    assert body["seasonType"] == "Deep Autumn" and body["id"] and body["analysisProvider"] == "gemini"
    saved = analysis_collections["color_analysis"].find_one({"id": body["id"]})
    assert saved["user_id"] == user["id"] and saved["analysis_model"] == "gemini-primary" and len(saved["colors_to_wear"]) == 6
    assert client.get(f"/api/quiz/color-analysis/{body['id']}", headers=headers).status_code == 200
    other_headers, _ = make_user()
    assert client.get(f"/api/quiz/color-analysis/{body['id']}", headers=other_headers).status_code == 404
    assert client.get(f"/api/quiz/color/{body['id']}", headers=other_headers).status_code == 404
    assert client.get(f"/api/quiz/color/{body['id']}/pdf", headers=other_headers).status_code == 404


def test_duplicate_submission_returns_saved_result_without_new_inference(client, make_user, provider):
    headers, _ = make_user()
    first = analyze(client, headers, request_id="same")
    second = analyze(client, headers, request_id="same")
    assert (first.status_code, second.status_code) == (201, 200)
    assert second.get_json()["id"] == first.get_json()["id"] and second.get_json()["cached"] is True
    assert len(provider.calls) == 1
    assert analysis_collections["color_analysis"].count_documents({"request_id": "same"}) == 1


def test_provider_failure_is_truthful_and_saves_nothing(client, make_user, provider):
    headers, user = make_user()
    provider.outcome = ProviderError("The AI analysis service is busy right now.", "temporary", retry_after=7)
    response = analyze(client, headers)
    assert response.status_code == 503
    body = response.get_json()
    assert body["errorCode"] == "provider_temporary" and body["retryable"] is True and body["retryAfterSeconds"] == 7
    assert "seasonType" not in body
    assert analysis_collections["color_analysis"].count_documents({"user_id": user["id"]}) == 0


def test_unavailable_providers_are_not_marked_retryable(client, make_user, provider):
    headers, _ = make_user()
    provider.outcome = ProviderError("No provider has quota.", "unavailable")
    body = analyze(client, headers).get_json()
    assert body["errorCode"] == "provider_unavailable" and body["retryable"] is False


def test_not_a_face_is_returned_but_not_saved(client, make_user, provider):
    headers, user = make_user()
    provider.outcome = {"isFace": False, "description": "Use daylight."}
    response = analyze(client, headers)
    assert response.status_code == 200 and response.get_json()["isFace"] is False
    assert analysis_collections["color_analysis"].count_documents({"user_id": user["id"]}) == 0


def test_profile_gender_is_never_sent_to_the_provider_or_used_to_reject(client, make_user, provider, monkeypatch):
    # Arrange: capture what the provider chain receives.
    received = []
    original = provider

    def capture(image, mime_type, previous=None, profile=None):
        received.append(profile)
        return original(image, mime_type, previous, profile)

    monkeypatch.setattr(color_providers, "analyze_color", capture)
    headers, user = make_user(gender="male")
    # Act
    response = analyze(client, headers)
    # Assert: the analysis is saved, the provider saw no gender, and the profile is unchanged.
    assert response.status_code == 201
    assert received and "gender" not in received[0]
    assert client.get("/api/users/profile", headers=headers).get_json()["user"]["gender"] == "male"
    prompt = color_providers.build_color_analysis_prompt(None, {"age": 30, "gender": "male"}).lower()
    assert "gender" not in prompt and "male" not in prompt


def test_color_styling_follows_preferences_without_changing_the_palette(client, make_user, provider):
    headers, _ = make_user(gender="male")
    body = analyze(client, headers).get_json()
    assert body["styling"]["catalog"] == "menswear" and body["styling"]["catalog_source"] == "profile"
    assert any(piece["piece"] == "Kurta" for outfit in body["styling"]["outfits"] for piece in outfit["pieces"])
    restyled = client.put(f"/api/quiz/color/{body['id']}/styling", headers=headers, json={"preferences": {"catalog": "womenswear"}}).get_json()["result"]
    assert restyled["styling"]["catalog"] == "womenswear"
    assert any("Saree" in piece["piece"] for outfit in restyled["styling"]["outfits"] for piece in outfit["pieces"])
    # The analysed palette is untouched and no extra AI call was made.
    assert (restyled["season_type"], restyled["colors_to_wear"]) == ("Deep Autumn", body["colorsToWear"])
    assert len(provider.calls) == 1


def test_persistence_failure_is_reported_separately_and_retry_reuses_result(client, make_user, provider, monkeypatch):
    headers, user = make_user()
    collection = analysis_collections["color_analysis"]
    original_insert = collection.insert_one

    class FailingCollection:
        def __getattr__(self, name):
            return getattr(collection, name)

        def insert_one(self, document):
            raise ServerSelectionTimeoutError("down")

    monkeypatch.setitem(analysis_collections, "color_analysis", FailingCollection())
    failed = analyze(client, headers, request_id="persist")
    assert failed.status_code == 503 and failed.get_json()["errorCode"] == "persistence_failed"
    monkeypatch.setitem(analysis_collections, "color_analysis", collection)
    assert collection.insert_one == original_insert
    retried = analyze(client, headers, request_id="persist")
    assert retried.status_code == 201
    assert len(provider.calls) == 1
    assert collection.count_documents({"user_id": user["id"]}) == 1


def test_concurrent_request_for_same_user_is_rejected(client, make_user, provider):
    headers, user = make_user()
    app.ACTIVE_COLOR_ANALYSES.add(user["id"])
    try:
        response = analyze(client, headers)
    finally:
        app.ACTIVE_COLOR_ANALYSES.discard(user["id"])
    assert response.status_code == 409 and provider.calls == []


def test_lock_is_released_when_database_fails_mid_request(client, make_user, provider, monkeypatch):
    headers, user = make_user()
    real_current_user, lookups = app.current_user, []

    # The authentication check uses auth_helpers; this patch only affects lookups inside the endpoint.
    def fails_inside_endpoint():
        lookups.append(1)
        raise ServerSelectionTimeoutError("down")

    monkeypatch.setattr(app, "current_user", fails_inside_endpoint)
    response = analyze(client, headers, request_id="db-down")
    assert len(lookups) == 1 and real_current_user is not fails_inside_endpoint
    assert response.status_code == 503 and response.get_json()["errorCode"] == "database_unavailable"
    assert user["id"] not in app.ACTIVE_COLOR_ANALYSES

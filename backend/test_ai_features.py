"""AI explanations, grounded trends, saved progress and routine repair. All providers are mocked."""

import pytest

import ai_routes
import app
import color_providers
from color_providers import ProviderError
from models import ai_cache, analysis_collections, trend_cache

BODY_ANSWERS = {"Q1": {"label": "C", "text": "Hips wider", "shapes": ["Pear"]}}
OILY = {str(i): {"label": "A", "text": "Oily"} for i in range(1, 11)}


@pytest.fixture(autouse=True)
def direct_chain(monkeypatch):
    """Run the provider callback once against a fake model instead of the configured chain."""
    ai_routes._recent.clear()
    trend_cache.delete_many({})
    ai_cache.delete_many({})

    def run_chain(call, budget, providers=None, label="", scope="default", text=False):
        # Mirrors the real chain: validation errors become a "malformed" provider failure.
        try:
            return call("gemini", "gemini-primary", 5), "gemini", "gemini-primary", []
        except ValueError as error:
            raise ProviderError(str(error), "malformed") from error

    monkeypatch.setattr(color_providers, "run_chain", run_chain)


def fake_text_model(monkeypatch, response):
    calls = []

    def call(model, image, mime_type, prompt, timeout):
        calls.append(prompt)
        if isinstance(response, Exception):
            raise response
        return response(prompt) if callable(response) else response

    monkeypatch.setitem(color_providers.PROVIDERS["gemini"], "call", call)
    return calls


def save_body(client, headers):
    return client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear"}).get_json()["result"]


# ---------- AI explanations ----------

def test_insights_only_explain_existing_items_and_are_sanitised(client, make_user, monkeypatch):
    headers, _ = make_user(gender="male")
    saved = save_body(client, headers)
    first_id = saved["styling"]["items"][0]["id"]
    prompts = fake_text_model(monkeypatch, {
        "summary": "Your Pear result pairs well with structured tops and straight trousers. <script>x</script> See https://evil.example",
        "notes": [{"id": first_id, "note": "A clean base layer **that** balances your proportions."}, {"id": "invented-item", "note": "Buy this!"}],
        "tips": ["Keep trousers straight.", "This will cure everything."],
    })
    response = client.post(f"/api/quiz/body-shape/{saved['id']}/insights", headers=headers)
    assert response.status_code == 200, response.get_json()
    insights = response.get_json()["insights"]
    assert set(insights["notes"]) == {first_id}
    assert "<" not in insights["summary"] and "https" not in insights["summary"] and "**" not in insights["notes"][first_id]
    assert insights["tips"] == ["Keep trousers straight."]
    # The prompt lists only engine-chosen items and the user's chosen catalog.
    assert first_id in prompts[0] and "Men's styling" in prompts[0]
    stored = client.get(f"/api/quiz/body-shape/{saved['id']}", headers=headers).get_json()["result"]
    assert stored["insights"]["notes"][first_id] and stored["styling"]["items"] == saved["styling"]["items"]


def test_insights_failure_is_honest_and_keeps_recommendations(client, make_user, monkeypatch):
    headers, _ = make_user(gender="female")
    saved = save_body(client, headers)
    fake_text_model(monkeypatch, ProviderError("busy", "temporary"))
    response = client.post(f"/api/quiz/body-shape/{saved['id']}/insights", headers=headers)
    body = response.get_json()
    assert response.status_code == 503 and body["errorCode"] == "provider_temporary" and body["retryable"] is True
    assert "gemini" not in body["error"].lower()
    stored = analysis_collections["body_shape"].find_one({"id": saved["id"]})
    assert "insights" not in stored and stored["styling"]["items"] == saved["styling"]["items"]


def test_unsafe_skincare_summary_is_rejected(client, make_user, monkeypatch):
    headers, _ = make_user()
    saved = client.post("/api/quiz/skincare", headers=headers, json={"answers": OILY, "result": "Oily Skin"}).get_json()["result"]
    fake_text_model(monkeypatch, {"summary": "This routine is clinically proven to cure your acne completely.", "notes": []})
    assert client.post(f"/api/quiz/skincare/{saved['id']}/insights", headers=headers).status_code == 503


def test_insights_respect_ownership_and_cooldown(client, make_user, monkeypatch):
    headers, _ = make_user()
    other, _ = make_user()
    saved = save_body(client, headers)
    fake_text_model(monkeypatch, {"summary": "A balanced, easy set of ideas for your proportions.", "notes": []})
    assert client.post(f"/api/quiz/body-shape/{saved['id']}/insights", headers=other).status_code == 404
    assert client.post(f"/api/quiz/body-shape/{saved['id']}/insights", headers=headers).status_code == 200
    assert client.post(f"/api/quiz/body-shape/{saved['id']}/insights", headers=headers).status_code == 429


# ---------- saved progress & routine repair ----------

def test_checklist_progress_persists_per_user(client, make_user):
    headers, _ = make_user()
    other, _ = make_user()
    saved = client.post("/api/quiz/skincare", headers=headers, json={"answers": OILY, "result": "Oily Skin"}).get_json()["result"]
    url = f"/api/quiz/skincare/{saved['id']}/progress"
    assert client.put(url, headers=headers, json={"checklist": {"am-cleanse": True}}).get_json()["user_state"]["checklist"] == {"am-cleanse": True}
    client.put(url, headers=headers, json={"checklist": {"pm-cleanse": True, "am-cleanse": False}})
    reopened = client.get(f"/api/quiz/skincare/{saved['id']}", headers=headers).get_json()["result"]
    assert reopened["user_state"]["checklist"] == {"am-cleanse": False, "pm-cleanse": True}
    assert client.put(url, headers=other, json={"checklist": {"am-cleanse": True}}).status_code == 404
    for bad in ({"checklist": {"a.b": True}}, {"checklist": {"x": "yes"}}, {"shades": ["#FFFFFF"]}, {}):
        assert client.put(url, headers=headers, json=bad).status_code == 400


def test_favourite_shades_only_for_color_results(client, make_user):
    headers, user = make_user()
    analysis_collections["color_analysis"].insert_one({"id": "shade-1", "user_id": user["id"], "is_face": True, "season_type": "Soft Autumn", "colors_to_wear": [{"name": "Rust", "hex": "#B7410E"}]})
    saved = client.put("/api/quiz/color/shade-1/progress", headers=headers, json={"shades": ["#b7410e", "#B7410E"]}).get_json()
    assert saved["user_state"]["shades"] == ["#B7410E"]
    assert client.put("/api/quiz/color/shade-1/progress", headers=headers, json={"shades": ["red"]}).status_code == 400


def test_missing_routine_is_rebuilt_from_answers_and_saved_once(client, make_user):
    headers, user = make_user()
    analysis_collections["skincare"].insert_one({"id": "old-skin", "user_id": user["id"], "result": "Oily Skin", "answers": OILY, "note": "keep me"})
    reopened = client.get("/api/quiz/skincare/old-skin", headers=headers).get_json()["result"]
    stored = analysis_collections["skincare"].find_one({"id": "old-skin"})
    assert reopened["plan"]["morning"] and stored["plan"] == reopened["plan"] and stored["note"] == "keep me"
    assert analysis_collections["skincare"].count_documents({"user_id": user["id"]}) == 1


def test_health_reports_api_version(client):
    assert client.get("/api/health").get_json()["api_version"] == app.API_VERSION == 2


def test_face_cards_expose_maintenance_for_filters(client, make_user):
    headers, _ = make_user(gender="male")
    saved = client.post("/api/quiz/face-shape", headers=headers, json={"answers": {"Q1": {"label": "B", "shapes": ["Round"]}}, "result": "Round"}).get_json()["result"]
    assert all(card["maintenance"] in {"low", "medium", "high"} for card in saved["styling"]["hair"])

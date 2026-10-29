"""RSS trends, stylist chat, occasion looks, inspiration board and regeneration. Providers and feeds are mocked."""

from datetime import timedelta

import pytest

import color_providers
import favorites
import skincare
import stylist
import trends
from color_providers import ProviderError
from models import ai_cache, analysis_collections, trend_cache, utc_now

BODY_ANSWERS = {"Q1": {"label": "C", "text": "Hips wider", "shapes": ["Pear"]}}


def rss(items, domain="vogue.com"):
    entries = "".join(f"<item><title>{title}</title><link>{link or f'https://www.{domain}/story/{index}'}</link><pubDate>{date}</pubDate><description>{summary}</description></item>"
                      for index, (title, summary, date, link) in enumerate(items))
    return f"<?xml version='1.0'?><rss><channel>{entries}</channel></rss>".encode()


TODAY = (utc_now() - timedelta(hours=3)).strftime("%a, %d %b %Y %H:%M:%S +0000")
OLD = (utc_now() - timedelta(days=90)).strftime("%a, %d %b %Y %H:%M:%S +0000")


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    trend_cache.delete_many({})
    ai_cache.delete_many({})
    trends._failures.clear()
    stylist._recent.clear()

    def run_chain(call, budget, providers=None, label="", scope="default", text=False):
        try:
            return call("gemini", "gemini-primary", 5), "gemini", "gemini-primary", []
        except ValueError as error:
            raise ProviderError(str(error), "malformed") from error

    monkeypatch.setattr(color_providers, "run_chain", run_chain)


def fake_model(monkeypatch, response):
    prompts = []

    def call(model, image, mime_type, prompt, timeout):
        prompts.append(prompt)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setitem(color_providers.PROVIDERS["gemini"], "call", call)
    return prompts


# ---------- RSS trends ----------

def test_feed_parsing_keeps_only_https_links_on_the_publisher_domain():
    raw = rss([("Best serums", "&lt;p&gt;A serum guide&lt;/p&gt;", TODAY, None), ("Spoof", "x", TODAY, "https://evil.example/a"), ("Plain http", "x", TODAY, "http://www.vogue.com/b")])
    items = trends.parse_feed(raw, trends.FEEDS["vogue"])
    assert [item["title"] for item in items] == ["Best serums"]
    assert items[0]["summary"] == "A serum guide" and items[0]["published_at"] is not None


def test_matching_needs_clear_relevance_recent_dates_and_clothing_context_for_colour():
    items = trends.parse_feed(rss([
        ("The 10 Best Layered Haircuts", "Layered hairstyle ideas", TODAY, None),
        ("Museum embraces kitsch. Will others follow suit?", "art", TODAY, None),
        ("Old haircut story", "haircut hairstyle", OLD, None),
        ("Best navy nail colors", "color shade navy", TODAY, None),
        ("Navy is the color to wear this fall", "An outfit in navy", TODAY, None),
    ]), trends.FEEDS["vogue"])
    face = [item["title"] for item, _ in trends.match(items, trends.KEYWORDS["face_shape"])]
    assert face == ["The 10 Best Layered Haircuts"]
    colour = [item["title"] for item, _ in trends.match(items, trends.KEYWORDS["color_analysis"], required=trends.REQUIRED_CONTEXT["color_analysis"])]
    assert colour == ["Navy is the color to wear this fall"]


def test_feeds_are_cached_and_reused(monkeypatch):
    calls = []
    monkeypatch.setattr(trends, "_download", lambda feed: calls.append(feed["publisher"]) or rss([("Best sunscreen for oily skin", "sunscreen serum", TODAY, None)], feed["domain"]))
    doc = {"result": "Oily Skin", "plan": skincare.skincare_plan({str(i): {"label": "A"} for i in range(1, 11)})}
    first = trends.get_trends("skincare", doc)
    second = trends.get_trends("skincare", doc)
    assert first["status"] == "ok" and first["items"][0]["url"].startswith("https://") and first["items"][0]["published_at"]
    assert first["items"][0]["matched"] and len(calls) == len(trends.FEEDS)
    assert second["sources"] == first["sources"] and len(calls) == len(trends.FEEDS)


def test_unavailable_feeds_give_labelled_evergreen_ideas_not_invented_trends(monkeypatch):
    def fail(feed):
        raise OSError("offline")

    monkeypatch.setattr(trends, "_download", fail)
    result = trends.get_trends("body_shape", {"result": "Pear", "styling": {"catalog": "menswear"}})
    assert result["status"] == "unavailable" and result["items"] == [] and len(result["evergreen"]) == 3
    # A cached copy is served (with its retrieval time, flagged stale) when a refresh fails.
    trend_cache.insert_one({"key": "feed:gq", "items": trends.parse_feed(rss([("5 date night outfits with tailoring", "outfit jacket", TODAY, None)], "gq.com"), trends.FEEDS["gq"]), "retrieved_at": utc_now() - timedelta(days=2)})
    trends._failures.clear()
    cached = trends.get_trends("body_shape", {"result": "Pear", "styling": {"catalog": "menswear"}})
    assert cached["status"] == "ok" and any(source["stale"] for source in cached["sources"] if source["publisher"] == "GQ")


def test_trends_route_is_owner_only(client, make_user, monkeypatch):
    monkeypatch.setattr(trends, "_download", lambda feed: rss([], feed["domain"]))
    headers, _ = make_user()
    other, _ = make_user()
    saved = client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear"}).get_json()["result"]
    assert client.get(f"/api/quiz/body-shape/{saved['id']}/trends", headers=other).status_code == 404
    body = client.get(f"/api/quiz/body-shape/{saved['id']}/trends", headers=headers).get_json()
    assert body["status"] == "no_matches" and body["evergreen"]


# ---------- stylist chat ----------

def test_chat_uses_only_the_users_own_results(client, make_user, monkeypatch):
    headers, user = make_user(gender="male")
    other_headers, _ = make_user(gender="female")
    client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear"})
    client.post("/api/quiz/face-shape", headers=other_headers, json={"answers": {"Q1": {"label": "B", "shapes": ["Round"]}}, "result": "Round"})
    prompts = fake_model(monkeypatch, {"reply": "Try a navy overshirt with straight chinos.\n- Add loafers.\nSee https://shop.example <b>now</b>", "follow_ups": ["What shoes?", ""]})
    response = client.post("/api/stylist/chat", headers=headers, json={"messages": [{"role": "user", "content": "Give me an office outfit"}], "module": "body_shape"})
    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert "https" not in body["reply"] and "<" not in body["reply"] and "\n- Add loafers." in body["reply"]
    assert body["follow_ups"] == ["What shoes?"]
    assert "Body shape (questionnaire): Pear" in prompts[0] and "Men's styling" in prompts[0] and "Round" not in prompts[0]


def test_chat_validates_input_and_reports_provider_failure(client, make_user, monkeypatch):
    headers, _ = make_user()
    assert client.post("/api/stylist/chat", headers=headers, json={"messages": []}).status_code == 400
    assert client.post("/api/stylist/chat", headers=headers, json={"messages": [{"role": "system", "content": "x"}]}).status_code == 400
    fake_model(monkeypatch, ProviderError("busy", "temporary"))
    response = client.post("/api/stylist/chat", headers=headers, json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 503 and response.get_json()["retryable"] is True
    assert client.post("/api/stylist/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


# ---------- occasion looks ----------

def save_palette(user_id):
    analysis_collections["color_analysis"].insert_one({"id": f"pal-{user_id[:6]}", "user_id": user_id, "is_face": True, "season_type": "Deep Autumn", "undertone": "Warm", "created_at": utc_now(),
                                                       "colors_to_wear": [{"name": "Rust", "hex": "#B7410E"}, {"name": "Olive", "hex": "#556B2F"}, {"name": "Cream", "hex": "#F5F0E1"}]})


def test_ai_looks_must_use_catalog_pieces_and_the_users_palette(client, make_user, monkeypatch):
    headers, user = make_user(gender="male")
    save_palette(user["id"])
    fake_model(monkeypatch, {"looks": [{"title": "Office ease", "why": "Structured top balances the frame.", "pieces": [{"item_id": "m-oxford", "hex": "#F5F0E1"}, {"item_id": "m-chinos", "hex": "#556B2F"}]}]})
    body = client.post("/api/stylist/looks", headers=headers, json={"occasion": "office"}).get_json()
    assert body["source"] == "ai" and body["looks"][0]["pieces"][0]["title"] == "Oxford shirts"
    # Invented pieces or colours are rejected and the user gets labelled rule-based looks instead.
    fake_model(monkeypatch, {"looks": [{"title": "Bad", "why": "x", "pieces": [{"item_id": "w-offshoulder", "hex": "#123456"}, {"item_id": "m-chinos", "hex": ""}]}]})
    stylist._recent.clear()
    ai_cache.delete_many({})
    fallback = client.post("/api/stylist/looks", headers=headers, json={"occasion": "office", "budget": "low"}).get_json()
    assert fallback["source"] == "rules" and "styling rules" in fallback["notice"] and fallback["budget_note"]
    pieces = [piece for look in fallback["looks"] for piece in look["pieces"]]
    assert pieces and all(piece["item_id"].startswith("m-") for piece in pieces)
    assert {piece["hex"] for piece in pieces} <= {"#B7410E", "#556B2F", "#F5F0E1"}


def test_looks_respect_catalog_override_and_validation(client, make_user, monkeypatch):
    headers, _ = make_user(gender="male")
    fake_model(monkeypatch, ProviderError("quota", "quota"))
    women = client.post("/api/stylist/looks", headers=headers, json={"occasion": "wedding", "catalog": "womenswear"}).get_json()
    assert women["catalog"] == "womenswear" and all(piece["item_id"].startswith("w-") for look in women["looks"] for piece in look["pieces"])
    assert client.post("/api/stylist/looks", headers=headers, json={"occasion": "moon"}).status_code == 400


# ---------- inspiration board & regeneration ----------

def test_board_saves_products_and_validated_looks(client, make_user):
    headers, _ = make_user()
    product = client.post("/api/favorites", headers=headers, json={"item_id": "plum-niacinamide-serum"}).get_json()["favorite"]
    assert product["kind"] == "product" and product["href"].startswith("https://") and product["photo"] == "plumserum.png"
    look = {"title": "Weekend ease", "occasion": "travel", "why": "Relaxed and balanced.", "pieces": [{"item_id": "u-hoodie", "hex": "#556b2f"}, {"item_id": "u-straight-denim"}]}
    saved = client.post("/api/favorites", headers=headers, json={"look": look})
    again = client.post("/api/favorites", headers=headers, json={"look": look})
    assert (saved.status_code, again.status_code) == (201, 200)
    piece = saved.get_json()["favorite"]["look"]["pieces"][0]
    # Pieces carry the catalog's current photo when it has one.
    assert {key: value for key, value in piece.items() if key != "photo"} == {"item_id": "u-hoodie", "title": "Hoodies & sweatshirts", "art": "hoodie", "hex": "#556B2F"}
    assert piece.get("photo") == favorites.CATALOG_ITEMS["u-hoodie"][1].get("photo")
    for bad in ({"title": "x", "pieces": [{"item_id": "invented"}, {"item_id": "u-hoodie"}]}, {"title": "x", "pieces": [{"item_id": "u-hoodie"}]}, {"title": "", "pieces": [{"item_id": "u-hoodie"}, {"item_id": "u-bag"}]}):
        assert client.post("/api/favorites", headers=headers, json={"look": bad}).status_code == 400
    kinds = sorted(item["kind"] for item in client.get("/api/favorites", headers=headers).get_json()["favorites"])
    assert kinds == ["look", "product"]


def test_regenerating_keeps_previous_versions(client, make_user):
    headers, _ = make_user(gender="male")
    saved = client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear"}).get_json()["result"]
    for catalog in ("unisex", "womenswear", "menswear"):
        client.put(f"/api/quiz/body-shape/{saved['id']}/styling", headers=headers, json={"preferences": {"catalog": catalog}})
    stored = analysis_collections["body_shape"].find_one({"id": saved["id"]})
    assert [entry["catalog"] for entry in stored["styling_history"]] == ["menswear", "unisex", "womenswear"]
    assert stored["styling"]["catalog"] == "menswear" and stored["result"] == "Pear"


def test_skincare_steps_explain_order_and_products_offer_verified_alternatives():
    plan = skincare.skincare_plan({str(i): {"label": "A"} for i in range(1, 11)}, ["advanced"])
    assert all(step["why"] for step in plan["morning"] + plan["evening"])
    cleanser = next(product for product in plan["products"] if product["step"] == "cleanse")
    assert cleanser["alternatives"] and all(alt["href"].startswith("https://") for alt in cleanser["alternatives"])
    sensitive = skincare.skincare_plan({str(i): {"label": "E"} for i in range(1, 11)})
    assert all(alt["id"] != "plum-niacinamide-serum" for product in sensitive["products"] for alt in product["alternatives"])


def test_rule_looks_are_complete_outfits_without_doubled_tops():
    prefs = __import__("preferences").resolve({}, "male")
    pool = stylist.look_pool(prefs, "wedding", None, None)
    items = [item for item in stylist.styling.CATALOG["body_items"] if stylist.styling._in_catalog(item, "menswear")]
    for look in stylist.rule_looks(pool, "Pear", [], catalog_items=items, occasion="wedding"):
        categories = [piece["category"] for piece in look["pieces"]]
        assert "footwear" in categories and len(categories) >= 3
        if any(piece["item"]["art"] in stylist.FULL_GARMENTS for piece in look["pieces"]):
            assert "tops" not in categories


def test_saved_results_and_favourites_show_current_photos_without_changing_recommendations(client, make_user, monkeypatch):
    import styling as styling_module
    import favorites as favorites_module
    headers, _ = make_user(gender="male")
    saved = client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear"}).get_json()["result"]
    first = saved["styling"]["items"][0]
    client.post("/api/favorites", headers=headers, json={"item_id": first["id"], "result_id": saved["id"]})
    # A newer photo arrives in the catalog after the result and favourite were saved.
    monkeypatch.setitem(styling_module.PHOTOS, first["id"], "photos/new-photo.jpg")
    catalog_entry = favorites_module.CATALOG_ITEMS[first["id"]]
    monkeypatch.setitem(favorites_module.CATALOG_ITEMS, first["id"], (catalog_entry[0], {**catalog_entry[1], "photo": "photos/new-photo.jpg"}))
    reopened = client.get(f"/api/quiz/body-shape/{saved['id']}", headers=headers).get_json()["result"]
    assert reopened["styling"]["items"][0]["photo"] == "photos/new-photo.jpg"
    assert [card["id"] for card in reopened["styling"]["items"]] == [card["id"] for card in saved["styling"]["items"]]
    assert analysis_collections["body_shape"].find_one({"id": saved["id"]})["styling"]["items"][0].get("photo") != "photos/new-photo.jpg"
    board = client.get("/api/favorites", headers=headers).get_json()["favorites"]
    assert board[0]["item_id"] == first["id"] and board[0]["photo"] == "photos/new-photo.jpg"

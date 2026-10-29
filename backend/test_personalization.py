"""Gender-aware and preference-aware personalization across the four modules."""

import json
from pathlib import Path

import pytest

import preferences
import skincare
import styling
from models import analysis_collections, user_profiles

BODY_ANSWERS = {"Q1": {"label": "C", "text": "Hips wider", "shapes": ["Pear"]}, "Q2": {"label": "A", "text": "Hips first", "shapes": ["Pear"]}, "Q3": {"label": "A", "text": "Defined", "shapes": ["Hourglass", "Pear"]}}
FACE_ANSWERS = {"Q1": {"label": "B", "text": "Same length and width", "shapes": ["Round"]}, "Q2": {"label": "A", "text": "Soft and round", "shapes": ["Round"]}}
OILY = {str(i): {"label": "A", "text": "Oily answer"} for i in range(1, 11)}
DRY = {str(i): {"label": "B", "text": "Dry answer"} for i in range(1, 11)}
WOMENSWEAR_ONLY = {item["id"] for item in styling.CATALOG["body_items"] if item["catalogs"] == ["womenswear"]}
MENSWEAR_ONLY = {item["id"] for item in styling.CATALOG["body_items"] if item["catalogs"] == ["menswear"]}


def save_body(client, headers, **extra):
    response = client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear", **extra})
    assert response.status_code in (200, 201), response.get_json()
    return response.get_json()["result"]


def item_ids(result):
    return {card["id"] for card in result["styling"]["items"]}


# ---------- catalog selection ----------

def test_male_profile_gets_the_mens_catalog_and_no_womenswear(client, make_user):
    headers, _ = make_user(gender="male")
    result = save_body(client, headers)
    assert result["styling"]["catalog"] == "menswear" and result["styling"]["catalog_source"] == "profile"
    ids = item_ids(result)
    assert ids <= MENSWEAR_ONLY and not ids & WOMENSWEAR_ONLY
    categories = {category["id"] for category in result["styling"]["categories"]}
    assert {"tops", "bottoms", "outerwear", "traditional", "footwear", "accessories"} <= categories and "dresses" not in categories


def test_female_profile_gets_the_womens_catalog(client, make_user):
    headers, _ = make_user(gender="female")
    result = save_body(client, headers)
    assert result["styling"]["catalog"] == "womenswear"
    assert item_ids(result) <= WOMENSWEAR_ONLY and "w-offshoulder" in item_ids(result)


def test_unisex_preference_overrides_profile_gender(client, make_user):
    headers, _ = make_user(gender="male")
    assert client.put("/api/users/preferences", headers=headers, json={"catalog": "unisex"}).status_code == 200
    result = save_body(client, headers)
    assert result["styling"]["catalog"] == "unisex" and result["styling"]["catalog_source"] == "preference"
    assert all(card["catalog"] == "unisex" for card in result["styling"]["items"])


def test_missing_gender_is_asked_not_defaulted_to_womenswear(client, make_user):
    headers, _ = make_user(gender="other")
    result = save_body(client, headers)
    assert result["styling"]["needs_choice"] is True and result["styling"]["catalog"] == "unisex"
    assert not item_ids(result) & WOMENSWEAR_ONLY


def test_retired_mixed_catalog_and_presentation_fall_back_to_the_documented_default(client, make_user):
    # Arrange: an older client still sends the retired "mixed" catalog and presentation.
    headers, user = make_user(gender="female")
    # Act
    response = client.put("/api/users/preferences", headers=headers, json={"catalog": "mixed", "presentation": "masculine"})
    result = save_body(client, headers)
    # Assert: accepted without error, nothing retired is stored, and the profile gender decides the catalog.
    assert response.status_code == 200
    assert user_profiles.find_one({"user_id": user["id"]}).get("style_preferences", {}) == {}
    assert result["styling"]["catalog"] == "womenswear" and result["styling"]["catalog_source"] == "profile"
    assert {card["catalog"] for card in result["styling"]["items"]} == {"womenswear"}


def test_legacy_stored_preferences_are_ignored_but_kept(client, make_user):
    # Arrange: a record saved before fit, upkeep, presentation, facial hair and extra occasions were retired.
    headers, user = make_user(gender="male")
    legacy = {"catalog": "mixed", "presentation": "feminine", "fit": "oversized", "maintenance": "low", "facial_hair": "beard", "occasions": ["wedding", "office"]}
    user_profiles.update_one({"user_id": user["id"]}, {"$set": {"user_id": user["id"], "style_preferences": legacy}}, upsert=True)
    # Act
    resolved = preferences.resolve(legacy, "male")
    body = save_body(client, headers)["styling"]
    face = save_face(client, headers)["styling"]
    # Assert
    assert resolved["catalog"] == "menswear" and resolved["occasions"] == ["office"]
    assert not {"presentation", "fit", "maintenance", "facial_hair"} & set(resolved)
    assert body["catalog"] == "menswear" and "beard" not in face and "maintenance_note" not in face
    assert user_profiles.find_one({"user_id": user["id"]})["style_preferences"] == legacy


def test_per_result_override_is_validated(client, make_user):
    headers, _ = make_user(gender="male")
    assert save_body(client, headers, styling_preferences={"catalog": "womenswear"})["styling"]["catalog"] == "womenswear"
    bad = client.post("/api/quiz/body-shape", headers=headers, json={"answers": BODY_ANSWERS, "result": "Pear", "styling_preferences": {"catalog": "<script>"}})
    assert bad.status_code == 400


def test_modest_preference_hides_revealing_items(client, make_user):
    headers, _ = make_user(gender="female")
    client.put("/api/users/preferences", headers=headers, json={"style_extras": ["modest"]})
    ids = item_ids(save_body(client, headers))
    revealing = {item["id"] for item in styling.CATALOG["body_items"] if "revealing" in item.get("flags", [])}
    assert ids and not ids & revealing


def test_occasion_preferences_change_the_ranking_and_fit_no_longer_does(client, make_user):
    headers, _ = make_user(gender="male")
    base = [card["id"] for card in save_body(client, headers)["styling"]["items"]]
    client.put("/api/users/preferences", headers=headers, json={"fit": "structured"})
    assert [card["id"] for card in save_body(client, headers)["styling"]["items"]] == base
    client.put("/api/users/preferences", headers=headers, json={"occasions": ["office"]})
    tuned = save_body(client, headers)["styling"]["items"]
    assert [card["id"] for card in tuned] != base
    assert any(reason == "Good for office" for card in tuned for reason in card["reasons"])
    assert not any("fit preference" in reason for card in tuned for reason in card["reasons"])


def test_body_cards_use_the_users_real_palette_and_never_invent_measurements(client, make_user):
    headers, user = make_user(gender="male")
    analysis_collections["color_analysis"].insert_one({"id": "pal-1", "user_id": user["id"], "is_face": True, "season_type": "Deep Autumn", "colors_to_wear": [{"name": "Rust", "hex": "#B7410E"}, {"name": "Olive", "hex": "#556B2F"}, {"name": "Cream", "hex": "#F5F0E1"}], "created_at": None})
    result = save_body(client, headers)
    palette_hexes = {"#B7410E", "#556B2F", "#F5F0E1"}
    assert result["styling"]["palette"]["result_id"] == "pal-1"
    assert all({color["hex"] for color in card["colors"]} <= palette_hexes for card in result["styling"]["items"])
    stored = analysis_collections["body_shape"].find_one({"id": result["id"]})
    assert not {"measurements", "bust", "waist", "hips", "height"} & set(stored)
    # Pear scored 3 and Hourglass 1: a clear result, with no alternative within one point.
    assert stored["confidence"] == {"level": "clear", "alternatives": [], "answered": 3}


def test_shape_confidence_reports_close_calls():
    answers = {"a": {"shapes": ["Pear"]}, "b": {"shapes": ["Apple"]}}
    assert styling.shape_confidence(answers, "Pear") == {"level": "mixed", "alternatives": ["Apple"], "answered": 2}


# ---------- persistence, history and ownership ----------

def test_preferences_persist_in_mongodb_and_reject_unknown_values(client, make_user):
    headers, user = make_user()
    saved = client.put("/api/users/preferences", headers=headers, json={"catalog": "menswear", "occasions": ["office", "office", "festive", "wedding"], "hair_texture": "wavy", "facial_hair": "beard"})
    assert saved.status_code == 200
    stored = user_profiles.find_one({"user_id": user["id"]})["style_preferences"]
    # Retired values (the "wedding" occasion, the facial-hair field) are accepted but never stored.
    assert stored == {"catalog": "menswear", "occasions": ["office", "festive"], "hair_texture": "wavy"}
    assert client.get("/api/users/profile", headers=headers).get_json()["user"]["style_preferences"] == stored
    for bad in ({"catalog": "robots"}, {"shoe_size": 9}, {"occasions": "office"}, {"occasions": ["moon"]}, ["catalog"]):
        assert client.put("/api/users/preferences", headers=headers, json=bad).status_code == 400
    cleared = client.put("/api/users/preferences", headers=headers, json={"hair_texture": None}).get_json()["preferences"]
    assert "hair_texture" not in cleared and cleared["catalog"] == "menswear"


def test_registration_accepts_optional_style_preferences(client):
    details = {"name": "Pref Signup", "email": "pref.signup@example.com", "password": "ValidPass!123", "style_preferences": {"catalog": "unisex"}}
    assert client.post("/api/auth/register", json=details).status_code == 201
    login = client.post("/api/auth/login", json={"email": details["email"], "password": details["password"]}).get_json()["user"]
    assert login["style_preferences"] == {"catalog": "unisex"}
    rejected = client.post("/api/auth/register", json={**details, "email": "x@example.com", "name": "Other", "style_preferences": {"catalog": "bad"}})
    assert rejected.status_code == 400


def test_new_preferences_do_not_rewrite_old_results(client, make_user):
    headers, _ = make_user(gender="male")
    old = save_body(client, headers)
    client.put("/api/users/preferences", headers=headers, json={"catalog": "womenswear"})
    reopened = client.get(f"/api/quiz/body-shape/{old['id']}", headers=headers).get_json()["result"]
    assert reopened["styling"]["catalog"] == "menswear" and "provisional" not in reopened["styling"]
    assert save_body(client, headers)["styling"]["catalog"] == "womenswear"


def test_restyling_changes_only_styling_and_respects_ownership(client, make_user):
    headers, _ = make_user(gender="male")
    other_headers, _ = make_user(gender="female")
    saved = save_body(client, headers)
    assert client.put(f"/api/quiz/body-shape/{saved['id']}/styling", headers=other_headers, json={"preferences": {"catalog": "unisex"}}).status_code == 404
    restyled = client.put(f"/api/quiz/body-shape/{saved['id']}/styling", headers=headers, json={"preferences": {"catalog": "unisex"}}).get_json()["result"]
    assert restyled["styling"]["catalog"] == "unisex" and (restyled["result"], restyled["answers"]) == (saved["result"], saved["answers"])
    assert client.get(f"/api/quiz/body-shape/{saved['id']}", headers=headers).get_json()["result"]["styling"]["catalog"] == "unisex"
    assert client.put(f"/api/quiz/skincare/{saved['id']}/styling", headers=headers, json={}).status_code == 400


def test_duplicate_submissions_are_idempotent(client, make_user):
    headers, user = make_user(gender="male")
    first = save_body(client, headers, request_id="body-1")
    second = save_body(client, headers, request_id="body-1")
    assert first["id"] == second["id"]
    assert analysis_collections["body_shape"].count_documents({"user_id": user["id"], "request_id": "body-1"}) == 1


def test_preferences_are_private_to_each_user(client, make_user):
    alice, _ = make_user(gender="female")
    bob, _ = make_user(gender="male")
    client.put("/api/users/preferences", headers=alice, json={"catalog": "mixed"})
    assert client.get("/api/users/preferences", headers=bob).get_json()["preferences"] == {}
    assert client.get("/api/users/preferences").status_code == 401


def test_legacy_results_stay_readable_with_labelled_provisional_styling(client, make_user):
    headers, user = make_user(gender="male")
    analysis_collections["body_shape"].insert_one({"id": "legacy-body", "user_id": user["id"], "result": "Pear", "answers": BODY_ANSWERS})
    analysis_collections["skincare"].insert_one({"id": "legacy-skin", "user_id": user["id"], "result": "Oily Skin", "answers": OILY, "recommendations": {"routine": ["Cleanse gently"]}})
    body = client.get("/api/quiz/body-shape/legacy-body", headers=headers).get_json()["result"]
    assert body["styling"]["provisional"] is True and body["styling"]["catalog"] == "menswear"
    assert "styling" not in analysis_collections["body_shape"].find_one({"id": "legacy-body"})
    skin = client.get("/api/quiz/skincare/legacy-skin", headers=headers).get_json()["result"]
    assert skin["plan"]["skin_type"] == "Oily Skin" and skin["plan"]["morning"]
    journal = client.get("/api/quiz/results", headers=headers).get_json()["results"]
    assert all("styling" not in doc and "plan" not in doc for docs in journal.values() for doc in docs)


# ---------- face ----------

def save_face(client, headers):
    return client.post("/api/quiz/face-shape", headers=headers, json={"answers": FACE_ANSWERS, "result": "Round"}).get_json()["result"]


def test_face_shape_is_unchanged_by_style_preferences(client, make_user):
    headers, _ = make_user(gender="male")
    men = save_face(client, headers)
    client.put("/api/users/preferences", headers=headers, json={"catalog": "womenswear"})
    women = save_face(client, headers)
    assert men["result"] == women["result"] == "Round"
    assert {card["id"] for card in men["styling"]["hair"]} != {card["id"] for card in women["styling"]["hair"]}
    assert all(card["catalog"] == "menswear" for card in men["styling"]["hair"])


@pytest.mark.parametrize("gender", ["male", "female", "other"])
def test_face_results_never_offer_beard_or_moustache_styling(client, make_user, gender):
    headers, _ = make_user(gender=gender)
    client.put("/api/users/preferences", headers=headers, json={"facial_hair": "beard"})
    face = save_face(client, headers)["styling"]
    cards = [card for key in ("hair", "hair_alternatives", "eyewear", "accessories") for card in face[key]]
    assert "beard" not in face and "beard_prompt" not in face and cards
    assert not any(card["id"].startswith("beard-") or card["group"] == "beard" for card in cards)
    assert not [item for item in styling.CATALOG["face_items"] if item["group"] == "beard"]


def test_texture_specific_cuts_need_a_reported_texture():
    base = preferences.resolve({"catalog": "menswear"}, None)
    curly = preferences.resolve({"catalog": "menswear", "hair_texture": "curly"}, None)
    ids = lambda prefs: {card["id"] for card in styling.face_styling("Round", prefs)["hair"] + styling.face_styling("Round", prefs)["hair_alternatives"]}  # noqa: E731
    assert "m-hair-curly-taper" not in ids(base) and "m-hair-curly-taper" in ids(curly)


def test_low_maintenance_and_length_preferences_filter_hair():
    prefs = preferences.resolve({"catalog": "menswear", "maintenance": "low", "hair_length": "long"}, None)
    result = styling.face_styling("Round", prefs)
    assert all("long" in card["lengths"] for card in result["hair"])
    assert "m-hair-pompadour" not in {card["id"] for card in result["hair"] + result["hair_alternatives"]}


def test_makeup_ideas_are_opt_in_and_use_the_palette():
    palette = {"colors": [{"name": "Rust", "hex": "#B7410E"}, {"name": "Cream", "hex": "#F5F0E1"}]}
    assert styling.face_styling("Oval", preferences.resolve({}, "female"), palette)["makeup"] is None
    makeup = styling.face_styling("Oval", preferences.resolve({"makeup": "yes"}, "male"), palette)["makeup"]
    assert makeup["available"] and {c["hex"] for idea in makeup["ideas"] for c in idea["colors"]} <= {"#B7410E", "#F5F0E1"}


# ---------- color ----------

def test_color_catalog_switch_never_changes_the_palette():
    doc = {"undertone": "Cool", "season_type": "Cool Summer", "colors_to_wear": [{"name": n, "hex": h} for n, h in (("Navy", "#1F2A44"), ("Rose", "#C98B9B"), ("Grey", "#8A8D91"), ("Teal", "#2F6F73"), ("Ice", "#E8EEF2"), ("Plum", "#5E3A5A"))], "colors_to_avoid": [{"name": "Orange", "hex": "#FF8C00"}]}
    original = json.dumps(doc, sort_keys=True)
    results = {catalog: styling.color_styling(doc, preferences.resolve({"catalog": catalog}, None)) for catalog in ("menswear", "womenswear", "unisex")}
    assert json.dumps(doc, sort_keys=True) == original
    palette = {color["hex"] for color in doc["colors_to_wear"]}
    for result in results.values():
        assert {piece["hex"] for outfit in result["outfits"] for piece in outfit["pieces"]} <= palette
        assert result["accessories"]["items"][0]["name"] == "Silver"
    assert any(p["piece"] == "Tie" for o in results["menswear"]["outfits"] for p in o["pieces"])
    assert any("Saree" in p["piece"] for o in results["womenswear"]["outfits"] for p in o["pieces"])
    assert "skirts" in results["womenswear"]["avoid"]["guidance"] and "skirts" not in results["menswear"]["avoid"]["guidance"]


def test_client_cannot_save_a_color_result_without_analysis(client, make_user):
    headers, user = make_user()
    response = client.post("/api/quiz/color-analysis", headers=headers, json={"is_face": True, "season_type": "Fake Spring"})
    assert response.status_code == 405
    assert analysis_collections["color_analysis"].count_documents({"user_id": user["id"]}) == 0


# ---------- skincare ----------

def test_skincare_depends_on_answers_not_gender(client, make_user):
    plans = []
    for gender in ("male", "female", "other"):
        headers, _ = make_user(gender=gender)
        saved = client.post("/api/quiz/skincare", headers=headers, json={"answers": OILY, "result": "Oily Skin"}).get_json()["result"]
        plans.append({key: value for key, value in saved["plan"].items()})
    assert plans[0] == plans[1] == plans[2]
    assert skincare.skincare_plan(OILY) != skincare.skincare_plan(DRY)


def test_skincare_ignores_client_recommendations_and_validates_extras(client, make_user):
    headers, _ = make_user()
    saved = client.post("/api/quiz/skincare", headers=headers, json={"answers": DRY, "result": "Dry Skin", "routine_extras": ["shaving", "razor_bumps"], "recommendations": {"products": [{"name": "Miracle cream", "href": "javascript:alert(1)"}]}}).get_json()["result"]
    assert "recommendations" not in saved and all(p["href"].startswith("https://") for p in saved["plan"]["products"])
    assert [section["id"] for section in saved["plan"]["sections"]] == ["shaving", "razor_bumps"]
    assert client.post("/api/quiz/skincare", headers=headers, json={"answers": DRY, "result": "Dry Skin", "routine_extras": ["tattoo"]}).status_code == 400


@pytest.mark.parametrize("extras,expected_sections", [([], []), (["beard"], ["beard"]), (["makeup", "workout"], ["workout", "makeup"])])
def test_optional_skincare_sections_appear_only_when_relevant(extras, expected_sections):
    plan = skincare.skincare_plan(OILY, extras)
    assert [section["id"] for section in plan["sections"]] == expected_sections
    assert ("pm-remove" in {step["id"] for step in plan["evening"]}) == ("makeup" in extras)


def test_simple_routine_has_three_core_steps_and_sensitive_skin_avoids_actives():
    simple = skincare.skincare_plan(OILY)
    assert [step["id"] for step in simple["morning"]] == ["am-cleanse", "am-moisturise", "am-protect"]
    advanced = skincare.skincare_plan(OILY, ["advanced"])
    assert "pm-treat" in {step["id"] for step in advanced["evening"]}
    sensitive = skincare.skincare_plan({str(i): {"label": "E"} for i in range(1, 11)}, ["advanced"])
    assert "plum-niacinamide-serum" not in {product["id"] for product in sensitive["products"]}
    assert any("sensitivity" in caution for caution in sensitive["cautions"])


def test_concern_reasons_name_each_concern_once():
    reasons = [product["reason"] for product in skincare.skincare_plan(OILY)["products"]]
    assert any("breakouts" in reason for reason in reasons)
    for reason in reasons:
        words = reason.replace(".", "").split(" and ")
        assert len(words) == len(set(words))


# ---------- favorites ----------

def test_favorites_come_from_the_catalog_and_are_private(client, make_user):
    headers, _ = make_user()
    other, _ = make_user()
    assert client.post("/api/favorites", headers=headers, json={"item_id": "not-real", "title": "<img onerror>"}).status_code == 400
    first = client.post("/api/favorites", headers=headers, json={"item_id": "m-blazer", "title": "ignored"})
    again = client.post("/api/favorites", headers=headers, json={"item_id": "m-blazer"})
    assert (first.status_code, again.status_code) == (201, 200) and first.get_json()["favorite"]["title"] == "Blazers"
    assert [f["item_id"] for f in client.get("/api/favorites", headers=headers).get_json()["favorites"]] == ["m-blazer"]
    assert client.get("/api/favorites", headers=other).get_json()["favorites"] == []
    client.delete("/api/favorites/m-blazer", headers=other)
    assert len(client.get("/api/favorites", headers=headers).get_json()["favorites"]) == 1
    client.delete("/api/favorites/m-blazer", headers=headers)
    assert client.get("/api/favorites", headers=headers).get_json()["favorites"] == []


# ---------- data integrity ----------

def test_catalog_items_are_complete_and_reference_real_assets():
    assets = Path(__file__).resolve().parent.parent / "web" / "public" / "assets"
    ids = [item["id"] for item in styling.CATALOG["body_items"] + styling.CATALOG["face_items"]]
    assert len(ids) == len(set(ids))
    for item in styling.CATALOG["body_items"] + styling.CATALOG["face_items"]:
        assert item["title"] and item["art"] and item["catalogs"]
        assert set(item.get("shapes", {})) <= set(styling.SHAPES) | set(styling.FACE_SHAPES), item["id"]
        if item.get("photo") and assets.exists():
            assert (assets / item["photo"]).exists(), item["photo"]
    for catalog in ("menswear", "womenswear", "unisex"):
        for shape in styling.SHAPES:
            assert styling.body_styling(shape, preferences.resolve({"catalog": catalog}, None))["items"]
        for shape in styling.FACE_SHAPES:
            assert styling.face_styling(shape, preferences.resolve({"catalog": catalog}, None))["hair"]


def test_web_test_fixtures_match_the_engine_output():
    import importlib.util
    script = Path(__file__).resolve().parent / "scripts" / "export_web_fixtures.py"
    spec = importlib.util.spec_from_file_location("export_web_fixtures", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not module.TARGET.exists():
        pytest.skip("web/ is not present in this checkout")
    assert json.loads(module.TARGET.read_text(encoding="utf-8")) == json.loads(json.dumps(module.build())), "Run scripts/export_web_fixtures.py"


def test_backend_preference_options_match_the_web_copy():
    web_copy = Path(__file__).resolve().parent.parent / "web" / "lib" / "preference-options.json"
    if not web_copy.exists():
        pytest.skip("web/ is not present in this checkout")
    assert json.loads(web_copy.read_text(encoding="utf-8")) == preferences.OPTIONS


@pytest.mark.parametrize("catalog", ["menswear", "womenswear", "unisex"])
def test_each_shape_gets_distinct_recommendations(catalog):
    prefs = preferences.resolve({"catalog": catalog}, None)
    body = {shape: [card["id"] for card in styling.body_styling(shape, prefs)["items"]] for shape in styling.SHAPES}
    face = {shape: [card["id"] for card in styling.face_styling(shape, prefs)["hair"] + styling.face_styling(shape, prefs)["eyewear"]] for shape in styling.FACE_SHAPES}
    # Every pair of shapes differs in its ranked ideas, not just in labels.
    for picks in (body, face):
        shapes = list(picks)
        for index, first in enumerate(shapes):
            for second in shapes[index + 1:]:
                assert picks[first] != picks[second], (catalog, first, second)
    # Shape-specific explanations are used where the catalog has them.
    pear = styling.body_styling("Pear", prefs)["items"]
    assert any(card["why"] != next(i["desc"] for i in styling.CATALOG["body_items"] if i["id"] == card["id"]) for card in pear)


def test_not_sure_answers_never_affect_results():
    not_sure = {"label": "?", "text": "Not sure"}
    oily = {**OILY, "3": not_sure, "9": not_sure}
    assert skincare.determine_skin_type(oily) == "Oily Skin"
    assert skincare.concerns_for({"1": {"label": "A"}, "9": not_sure}) == skincare.concerns_for({"1": {"label": "A"}})
    confidence = styling.shape_confidence({"Q1": {"label": "C", "shapes": ["Pear"]}, "Q2": {**not_sure, "shapes": []}}, "Pear")
    assert confidence["alternatives"] == [] and confidence["level"] == "leaning"

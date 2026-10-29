"""PDF download tests: every result type produces a real, readable PDF with the saved result's content."""

import io
import json
from datetime import timedelta
from pathlib import Path

import pytest
from flask_jwt_extended import create_access_token
from pypdf import PdfReader

import app
import pdf_reports
from models import analysis_collections, utc_now


def pdf_text(response):
    assert response.status_code == 200, response.get_data(as_text=True)[:200]
    assert response.content_type == "application/pdf"
    assert response.headers["Cache-Control"] == "no-store"
    reader = PdfReader(io.BytesIO(response.get_data()))
    # Collapse PDF line wrapping so assertions can match whole phrases.
    return reader, " ".join(" ".join(page.extract_text() for page in reader.pages).split())


def save(kind, user_id, **fields):
    document = {"id": f"{kind}-{user_id[:6]}-{len(fields)}", "user_id": user_id, "created_at": utc_now(), **fields}
    analysis_collections[kind].insert_one(document)
    return document["id"]


COLORS = [{"name": f"Terracotta {i}", "hex": f"#C2593{i}"} for i in range(6)]
AVOID = [{"name": "Icy Lavender", "hex": "#E6E6FA"}, {"name": "Neon Pink", "hex": "#FF1493"}, {"name": "Baby Blue", "hex": "#AFDBF5"}]


@pytest.mark.parametrize("route_type", ["color-analysis", "color", "color_analysis"])
def test_color_pdf_works_for_every_route_alias_used_by_the_web_app(client, make_user, route_type):
    headers, user = make_user()
    result_id = save("color_analysis", user["id"], is_face=True, season_type="Deep Autumn", season_description="Rich, warm & earthy.", undertone="Warm",
                     undertone_description="Golden <undertones>", skin_age=32, colors_to_wear=COLORS, colors_to_avoid=AVOID, request_id="secret-request", analysis_model="gemini-x")
    response = client.get(f"/api/quiz/{route_type}/{result_id}/pdf", headers=headers)
    _, text = pdf_text(response)
    assert response.headers["Content-Disposition"] == 'attachment; filename="MatchMyTone-Color-Analysis.pdf"'
    for expected in ("MatchMyTone", "Color Analysis", "Deep Autumn", "Warm", "Rich, warm & earthy.", "Golden <undertones>", "#C25930", "#C25935", "Icy Lavender", "#E6E6FA", "Colors to avoid"):
        assert expected in text, expected
    for internal in ("secret-request", "gemini-x", user["id"]):
        assert internal not in text


@pytest.mark.parametrize("gender,route_type,kind,result,expected,filename", [
    ("other", "skincare", "skincare", "Oily Skin", ["Oily Skin", "Minimalist B12", "Caution: Patch-test", "not a medical diagnosis", "Shiny by noon"], "MatchMyTone-Skincare-Analysis.pdf"),
    ("female", "face-shape", "face_shape", "Heart", ["Heart", "Wispy fringe", "Eyewear", "semi-rimless frames", "not a measurement", "Women's styling"], "MatchMyTone-Face-Shape-Analysis.pdf"),
    ("female", "body-shape", "body_shape", "Pear", ["Pear", "Off-shoulder tops", "Fit, proportion and styling", "every shape is a good shape", "Women's styling"], "MatchMyTone-Body-Shape-Analysis.pdf"),
    ("male", "body-shape", "body_shape", "Pear", ["Triangle (Pear)", "Blazers", "Kurtas", "Trouser length", "Men's styling"], "MatchMyTone-Body-Shape-Analysis.pdf"),
    ("other", "body-shape", "body_shape", "Pear", ["Triangle (Pear)", "Oversized T-shirts", "Unisex styling"], "MatchMyTone-Body-Shape-Analysis.pdf"),
])
def test_questionnaire_pdfs_include_result_recommendations_and_answers(client, make_user, gender, route_type, kind, result, expected, filename):
    headers, user = make_user(gender=gender)
    fields = {"result": result, "answers": {"1": {"label": "A", "text": "Shiny by noon"}, "2": {"label": "B", "text": "Tight after washing"}}}
    if kind == "skincare":
        fields["recommendations"] = {"routine": ["Cleanse gently"], "products": [{"brand": "Minimalist", "name": "B12 + Oat Cleanser", "category": "Cleanser", "reason": "For oil control.", "caution": "Patch-test first.", "href": "https://beminimalist.co/"}]}
    response = client.get(f"/api/quiz/{route_type}/{save(kind, user['id'], **fields)}/pdf", headers=headers)
    _, text = pdf_text(response)
    assert response.headers["Content-Disposition"] == f'attachment; filename="{filename}"'
    for item in expected:
        assert item in text, item
    if gender == "male":
        for womenswear in ("Off-shoulder", "Fit-and-flare", "Flared trousers", "Cropped jackets", "Boat-neck"):
            assert womenswear not in text, womenswear


def test_pdf_uses_the_saved_styling_snapshot_not_current_preferences(client, make_user):
    headers, user = make_user(gender="male")
    saved = client.post("/api/quiz/body-shape", headers=headers, json={"answers": {"Q1": {"label": "B", "shapes": ["Inverted Triangle"]}}, "result": "Inverted Triangle"}).get_json()["result"]
    client.put("/api/users/preferences", headers=headers, json={"catalog": "womenswear"})
    _, text = pdf_text(client.get(f"/api/quiz/body-shape/{saved['id']}/pdf", headers=headers))
    assert "Men's styling" in text and "Women's styling" not in text


def test_legacy_documents_without_dates_or_dict_colors_still_render(client, make_user):
    headers, user = make_user()
    analysis_collections["color_analysis"].insert_one({"id": "legacy-color", "user_id": user["id"], "seasonType": "Soft Summer", "colorsToWear": ["Dusty Rose #C9A0A0", "not-a-color"], "created_at": "garbage"})
    _, text = pdf_text(client.get("/api/quiz/color/legacy-color/pdf", headers=headers))
    assert "Soft Summer" in text and "#C9A0A0" in text and "Not recorded" in text
    analysis_collections["skincare"].insert_one({"id": "legacy-skin", "user_id": user["id"], "result": "Unknown Type", "answers": "not-a-dict"})
    _, text = pdf_text(client.get("/api/quiz/skincare/legacy-skin/pdf", headers=headers))
    assert "Unknown Type" in text


def test_long_content_spans_multiple_pages_with_page_numbers(client, make_user):
    headers, user = make_user()
    answers = {str(i): {"label": "A", "text": f"Answer number {i} " + "with plenty of descriptive detail " * 12} for i in range(40)}
    result_id = save("body_shape", user["id"], result="Hourglass", answers=answers)
    reader, text = pdf_text(client.get(f"/api/quiz/body-shape/{result_id}/pdf", headers=headers))
    assert len(reader.pages) >= 3
    assert "Page 1" in text and f"Page {len(reader.pages)}" in text
    assert "Answer number 39" in text


def test_special_characters_are_rendered_safely(client, make_user):
    headers, user = make_user()
    result_id = save("color_analysis", user["id"], season_type="Café Autumn — “warm” <b>bold</b> & 🎨", colors_to_wear=[{"name": "Crème brûlée", "hex": "#f3e5ab"}])
    _, text = pdf_text(client.get(f"/api/quiz/color/{result_id}/pdf", headers=headers))
    assert "Café Autumn — “warm” <b>bold</b> &" in text
    assert "Crème brûlée" in text and "#F3E5AB" in text


def test_missing_invalid_and_foreign_results_are_rejected(client, make_user):
    owner_headers, owner = make_user()
    other_headers, _ = make_user()
    result_id = save("face_shape", owner["id"], result="Oval", answers={"Q1": {"label": "A"}})
    assert client.get(f"/api/quiz/face-shape/{result_id}/pdf", headers=other_headers).status_code == 404
    assert client.get("/api/quiz/face-shape/does-not-exist/pdf", headers=owner_headers).get_json()["errorCode"] == "not_found"
    assert client.get(f"/api/quiz/hair/{result_id}/pdf", headers=owner_headers).get_json()["errorCode"] == "invalid_type"
    assert client.get(f"/api/quiz/face-shape/{result_id}/pdf").status_code == 401


def test_expired_session_cannot_download(client, make_user):
    _, user = make_user()
    result_id = save("face_shape", user["id"], result="Oval", answers={"Q1": {"label": "A"}})
    with app.app.app_context():
        expired = create_access_token(identity=user["id"], expires_delta=timedelta(seconds=-1))
    response = client.get(f"/api/quiz/face-shape/{result_id}/pdf", headers={"Authorization": f"Bearer {expired}"})
    assert response.status_code == 401 and response.get_json()["errorCode"] == "session_expired"


def test_generation_failure_returns_retryable_json_without_internals(client, make_user, monkeypatch):
    headers, user = make_user()
    result_id = save("body_shape", user["id"], result="Pear", answers={"Q1": {"label": "A"}})
    monkeypatch.setattr(pdf_reports, "build_pdf", lambda kind, doc: (_ for _ in ()).throw(KeyError("internal detail")))
    response = client.get(f"/api/quiz/body-shape/{result_id}/pdf", headers=headers)
    assert response.status_code == 500 and response.get_json() == {"error": "We couldn't create your summary right now. Please try again.", "errorCode": "pdf_failed"}


def test_backend_style_guides_match_the_web_copy():
    web_copy = Path(__file__).resolve().parent.parent / "web" / "lib" / "style-guides.json"
    if not web_copy.exists():
        pytest.skip("web/ is not present in this checkout")
    assert json.loads(web_copy.read_text(encoding="utf-8")) == pdf_reports.GUIDES

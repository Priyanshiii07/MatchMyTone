"""Branded, printable PDF summaries for saved MatchMyTone analyses.

Documents may come from older schema versions, so every field is read defensively.
All user-controlled text is escaped before it reaches ReportLab's paragraph markup.
"""

from datetime import datetime
from html import escape
from io import BytesIO
import json
from pathlib import Path
import re
import unicodedata

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GUIDES = json.loads(Path(__file__).with_name("style_guides.json").read_text(encoding="utf-8"))

GOLD = colors.HexColor("#B89018")
BRONZE = colors.HexColor("#A46B39")
INK = colors.HexColor("#2C2C2C")
MUTED = colors.HexColor("#6B6B6B")
CREAM = colors.HexColor("#FFF8E7")
LINE = colors.HexColor("#E8D9A8")
HEX_PATTERN = re.compile(r"#?([0-9a-fA-F]{6})")

TITLES = {
    "color_analysis": ("Color Analysis", "MatchMyTone-Color-Analysis.pdf"),
    "skincare": ("Skincare Analysis", "MatchMyTone-Skincare-Analysis.pdf"),
    "face_shape": ("Face Shape Analysis", "MatchMyTone-Face-Shape-Analysis.pdf"),
    "body_shape": ("Body Shape Analysis", "MatchMyTone-Body-Shape-Analysis.pdf"),
}


def filename_for(kind):
    return TITLES[kind][1]


def _plain(value):
    """Text safe for the built-in PDF fonts (cp1252) and for paragraph markup."""
    text = unicodedata.normalize("NFKC", str(value if value is not None else "")).strip()
    text = text.encode("cp1252", errors="ignore").decode("cp1252")
    return escape(text, quote=False)


def _styles():
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle("Brand", parent=base["Normal"], fontName="Times-Bold", fontSize=13, textColor=GOLD, leading=16),
        "title": ParagraphStyle("Title", parent=base["Title"], fontName="Times-Roman", fontSize=30, leading=34, textColor=INK, alignment=0, spaceAfter=4),
        "result": ParagraphStyle("Result", parent=base["Normal"], fontName="Times-Italic", fontSize=22, leading=27, textColor=BRONZE, spaceAfter=4),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontSize=9, textColor=MUTED, leading=12),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceBefore=14, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=10, leading=14.5, textColor=INK),
        "small": ParagraphStyle("Small", parent=base["BodyText"], fontSize=8.5, leading=12, textColor=MUTED),
        "label": ParagraphStyle("Label", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=BRONZE),
        "cell": ParagraphStyle("Cell", parent=base["BodyText"], fontSize=9.5, leading=13, textColor=INK),
        "center": ParagraphStyle("Center", parent=base["BodyText"], fontSize=8, leading=10, textColor=MUTED, alignment=TA_CENTER),
    }


def _format_date(value):
    if isinstance(value, datetime):
        moment = value
    else:
        try:
            moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return ""
    return f"{moment.day} {moment:%B %Y, %H:%M} UTC"


def _section(story, styles, title):
    story.append(Paragraph(_plain(title), styles["h2"]))


def _bullets(items, styles):
    items = [item for item in items if item]
    return ListFlowable([ListItem(Paragraph(item, styles["body"]), leftIndent=12) for item in items], bulletType="bullet", start="•", leftIndent=12, bulletColor=GOLD)


def _findings_table(rows, styles):
    rows = [(label, value) for label, value in rows if value not in (None, "")]
    if not rows:
        return None
    table = Table([[Paragraph(_plain(label).upper(), styles["label"]), Paragraph(_plain(value), styles["cell"])] for label, value in rows], colWidths=[42 * mm, None])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return table


def _color_items(value):
    """Normalize swatch lists from every stored shape: dicts, 'Name #HEX' strings or bare hex strings."""
    items = []
    for entry in value if isinstance(value, list) else []:
        if isinstance(entry, dict):
            name, raw_hex = entry.get("name") or entry.get("label") or "", str(entry.get("hex") or entry.get("color") or "")
        else:
            raw_hex = str(entry)
            name = HEX_PATTERN.sub("", raw_hex).strip(" -:")
        match = HEX_PATTERN.search(raw_hex)
        items.append({"name": str(name).strip() or (f"#{match.group(1).upper()}" if match else "Color"), "hex": f"#{match.group(1).upper()}" if match else None})
    return items


def _swatch_table(items, styles):
    rows, style = [], [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE)]
    for index, item in enumerate(items):
        rows.append(["", Paragraph(_plain(item["name"]), styles["cell"]), Paragraph(_plain(item["hex"] or "Not recorded"), styles["cell"])])
        if item["hex"]:
            style += [("BACKGROUND", (0, index), (0, index), colors.HexColor(item["hex"])), ("BOX", (0, index), (0, index), 0.5, colors.HexColor("#D8CFC0"))]
    table = Table(rows, colWidths=[16 * mm, None, 32 * mm], rowHeights=[11 * mm] * len(rows))
    table.setStyle(TableStyle(style))
    return table


def _answer_texts(answers):
    texts = []
    items = sorted(answers.items(), key=lambda pair: (len(str(pair[0])), str(pair[0]))) if isinstance(answers, dict) else []
    for _, answer in items:
        if isinstance(answer, dict):
            text = answer.get("text") or answer.get("label")
        else:
            text = answer
        if text:
            texts.append(_plain(text))
    return texts


def _color_story(doc, styles, story):
    season = doc.get("season_type") or doc.get("seasonType") or "Your color profile"
    story.append(Paragraph(_plain(season), styles["result"]))
    if doc.get("season_description") or doc.get("seasonDescription"):
        story.append(Paragraph(_plain(doc.get("season_description") or doc.get("seasonDescription")), styles["body"]))
    story.append(Spacer(1, 8))
    table = _findings_table([
        ("Seasonal palette", season), ("Undertone", doc.get("undertone")), ("Undertone notes", doc.get("undertone_description") or doc.get("undertoneDescription")),
        ("Approx. visual skin age", doc.get("skin_age") if doc.get("skin_age") is not None else doc.get("skinAge")),
    ], styles)
    if table:
        story.append(table)
    for title, key, camel in (("Colors to wear", "colors_to_wear", "colorsToWear"), ("Colors to avoid", "colors_to_avoid", "colorsToAvoid")):
        items = _color_items(doc.get(key) or doc.get(camel))
        if items:
            story.append(KeepTogether([Paragraph(title, styles["h2"]), _swatch_table(items, styles)]))
    color_styling = _styling(doc)
    if color_styling.get("outfits"):
        story.append(Paragraph(f"Outfit combinations — {_plain(color_styling.get('catalog_label', ''))}", styles["h2"]))
        for outfit in color_styling["outfits"]:
            pieces = ", ".join(f"{_plain(piece.get('piece'))}: {_plain(piece.get('name'))} ({_plain(piece.get('hex'))})" for piece in outfit.get("pieces", []))
            story.append(Paragraph(f"<b>{_plain(outfit.get('title'))}</b> — {pieces}", styles["body"]))
            story.append(Spacer(1, 4))
    accessories = color_styling.get("accessories") or {}
    if accessories.get("items"):
        lines = [_plain(accessories.get("summary"))] + [f"{_plain(item.get('name'))} ({_plain(item.get('hex'))})" for item in accessories["items"]]
        story.append(KeepTogether([Paragraph("Accessory metals & leathers", styles["h2"]), _bullets(lines, styles)]))
    avoid_guidance = (color_styling.get("avoid") or {}).get("guidance") or "Use colors to avoid away from the face, for example in trousers, shoes or bags."
    story.append(Paragraph("How to use your palette", styles["h2"]))
    story.append(_bullets(["Wear your recommended shades closest to your face — tops, scarves, collars and earrings.", _plain(avoid_guidance), "Compare shades in daylight; indoor lighting can shift how colors look."], styles))
    return "color"


def _styling(doc):
    return doc.get("styling") if isinstance(doc.get("styling"), dict) else {}


def _card_lines(cards):
    lines = []
    for card in cards if isinstance(cards, list) else []:
        if not isinstance(card, dict) or not card.get("title"):
            continue
        line = f"<b>{_plain(card['title'])}</b> — {_plain(card.get('why'))}"
        if card.get("tip"):
            line += f" <i>Tip: {_plain(card['tip'])}</i>"
        colors = ", ".join(_plain(color.get("name")) for color in card.get("colors", []) if isinstance(color, dict))
        if colors:
            line += f" <font color='#6B6B6B'>Your shades: {colors}</font>"
        lines.append(line)
    return lines


def _card_section(story, styles, title, cards):
    lines = _card_lines(cards)
    if lines:
        story.append(KeepTogether([Paragraph(_plain(title), styles["h2"]), _bullets(lines, styles)]))


def _body_styling(snapshot, styles, story):
    labels = {category["id"]: category["label"] for category in snapshot.get("categories", []) if isinstance(category, dict)}
    for category_id, label in labels.items():
        _card_section(story, styles, label, [card for card in snapshot.get("items", []) if isinstance(card, dict) and card.get("category") == category_id])
    notes = [_plain(note) for note in snapshot.get("shape_notes", [])]
    notes += [f"<b>{_plain(entry.get('topic'))}:</b> {_plain(entry.get('tip'))}" for entry in snapshot.get("fit_guide", []) if isinstance(entry, dict)]
    if notes:
        story.append(KeepTogether([Paragraph("Fit, proportion and styling", styles["h2"]), _bullets(notes, styles)]))


def _face_styling(snapshot, styles, story):
    for title, key in (("Recommended hairstyles", "hair"), ("Alternative hairstyles", "hair_alternatives"), ("Eyewear", "eyewear"), ("Accessories", "accessories")):
        _card_section(story, styles, title, snapshot.get(key))
    grooming = [f"<b>{_plain(entry.get('topic'))}:</b> {_plain(entry.get('tip'))}" for entry in snapshot.get("grooming", []) if isinstance(entry, dict)]
    if grooming:
        story.append(KeepTogether([Paragraph("Grooming & maintenance", styles["h2"]), _bullets(grooming, styles)]))


def _shape_story(doc, styles, story, kind):
    result = str(doc.get("result") or "")
    guide = GUIDES[kind].get(result, {})
    snapshot = _styling(doc)
    story.append(Paragraph(_plain(snapshot.get("shape_label") or result or "Your result"), styles["result"]))
    if guide.get("description"):
        story.append(Paragraph(_plain(guide["description"]), styles["body"]))
    if snapshot.get("catalog_label"):
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Styling catalog:</b> {_plain(snapshot['catalog_label'])}", styles["body"]))
    if guide.get("why"):
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"<b>Why these ideas:</b> {_plain(guide['why'])}", styles["body"]))
    if kind == "body":
        _body_styling(snapshot, styles, story)
    else:
        _face_styling(snapshot, styles, story)
    answers = _answer_texts(doc.get("answers"))
    if answers:
        story.append(KeepTogether([Paragraph("Your answers", styles["h2"]), _bullets(answers, styles)]))
    return "face" if kind == "face" else "body"


def _plan_steps(steps):
    return [f"<b>{_plain(step.get('label'))}</b> — {_plain(step.get('detail'))}" for step in steps if isinstance(step, dict)]


def _skincare_plan_story(plan, styles, story):
    for title, key in (("Morning routine", "morning"), ("Evening routine", "evening")):
        lines = _plan_steps(plan.get(key, []))
        if lines:
            story.append(KeepTogether([Paragraph(title, styles["h2"]), _bullets(lines, styles)]))
    for section in plan.get("sections", []):
        if isinstance(section, dict):
            story.append(KeepTogether([Paragraph(_plain(section.get("title")), styles["h2"]), _bullets(_plan_steps(section.get("steps", [])), styles)]))
    cautions = [_plain(text) for text in plan.get("cautions", [])]
    if cautions:
        story.append(KeepTogether([Paragraph("Safety notes", styles["h2"]), _bullets(cautions, styles)]))


def _skincare_story(doc, styles, story):
    result = str(doc.get("result") or "")
    guide = GUIDES["skincare"].get(result, {})
    story.append(Paragraph(_plain(result or "Your skin profile"), styles["result"]))
    if guide.get("description"):
        story.append(Paragraph(_plain(guide["description"]), styles["body"]))
    if guide.get("focus"):
        story.append(KeepTogether([Paragraph("Your routine focus", styles["h2"]), _bullets([_plain(item) for item in guide["focus"]], styles)]))
    plan = doc.get("plan") if isinstance(doc.get("plan"), dict) else {}
    recommendations = doc.get("recommendations") if isinstance(doc.get("recommendations"), dict) else {}
    if plan:
        _skincare_plan_story(plan, styles, story)
    else:
        routine = [_plain(step) for step in recommendations.get("routine", []) if isinstance(step, str)]
        if routine:
            story.append(KeepTogether([Paragraph("Simple routine", styles["h2"]), _bullets(routine, styles)]))
    products = [item for item in (plan.get("products") or recommendations.get("products") or []) if isinstance(item, dict) and item.get("name")]
    if products:
        story.append(Paragraph("Recommended for your answers", styles["h2"]))
        for product in products:
            lines = [f"<b>{_plain(product.get('brand', ''))} {_plain(product['name'])}</b> <font color='#6B6B6B'>({_plain(product.get('category', ''))})</font>"]
            if product.get("reason") or product.get("description"):
                lines.append(_plain(product.get("reason") or product.get("description")))
            if product.get("caution"):
                lines.append(f"<i>Caution: {_plain(product['caution'])}</i>")
            if str(product.get("href", "")).startswith("https://"):
                lines.append(f"<font color='#8B6C18'>{_plain(product['href'])}</font>")
            story.append(KeepTogether([Paragraph("<br/>".join(lines), styles["body"]), Spacer(1, 7)]))
    answers = _answer_texts(doc.get("answers"))
    if answers:
        story.append(KeepTogether([Paragraph("Your answers", styles["h2"]), _bullets(answers, styles)]))
    return "skincare"


def build_pdf(kind, doc):
    """Return PDF bytes for a saved analysis document of the given collection kind."""
    title, _ = TITLES[kind]
    styles = _styles()
    buffer = BytesIO()

    def decorate(canvas, document):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(GOLD)
        canvas.rect(0, height - 6 * mm, width, 6 * mm, stroke=0, fill=1)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(18 * mm, 16 * mm, width - 18 * mm, 16 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 11 * mm, f"MatchMyTone · {title}")
        canvas.drawRightString(width - 18 * mm, 11 * mm, f"Page {document.page}")
        canvas.restoreState()

    pdf = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=24 * mm, title=f"MatchMyTone {title}", author="MatchMyTone")
    story = [Paragraph("MatchMyTone", styles["brand"]), Spacer(1, 10), Paragraph(_plain(title), styles["title"])]
    saved = _format_date(doc.get("created_at"))
    story.append(Paragraph(f"Saved {saved}" if saved else "Saved to your MatchMyTone results", styles["meta"]))
    story.append(Spacer(1, 14))
    if kind == "color_analysis":
        disclaimer_key = _color_story(doc, styles, story)
    elif kind == "skincare":
        disclaimer_key = _skincare_story(doc, styles, story)
    else:
        disclaimer_key = _shape_story(doc, styles, story, "face" if kind == "face_shape" else "body")
    story += [Spacer(1, 18), Paragraph(_plain(GUIDES["disclaimers"][disclaimer_key]), styles["small"])]
    pdf.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()

"""The user's inspiration board: saved catalog styles, skincare products and generated looks.

Everything shown on the board comes from our own catalogs or is validated against them; request
text is never trusted for titles, images or links.
"""

import hashlib
import json
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from pymongo.errors import DuplicateKeyError

import skincare
import styling
from ai_insights import clean
from auth_helpers import require_user
from models import style_favorites, utc_now

bp = Blueprint("favorites", __name__)
CATALOG_ITEMS = {item["id"]: ("body", item) for item in styling.CATALOG["body_items"]} | {item["id"]: ("face", item) for item in styling.CATALOG["face_items"]}
PRODUCTS = {product["id"]: product for product in skincare.DATA["products"]}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_LOOKS = 50


def _current_photo(item_id, saved=None):
    """The catalog's current photo for an item, so favourites saved earlier pick up newer photography."""
    entry = CATALOG_ITEMS.get(item_id)
    return (entry[1].get("photo") if entry else None) or saved


def _public(document):
    keys = ("item_id", "kind", "module", "title", "category", "art", "photo", "catalog", "result_id", "href", "look")
    public = {key: document.get(key) for key in keys} | {"kind": document.get("kind") or "style", "created_at": document["created_at"].isoformat()}
    if public["kind"] == "style":
        public["photo"] = _current_photo(document.get("item_id"), document.get("photo"))
    if public["kind"] == "look" and isinstance(public.get("look"), dict):
        public["look"] = {**public["look"], "pieces": [{**piece, **({"photo": photo} if (photo := _current_photo(piece.get("item_id"), piece.get("photo"))) else {})} for piece in public["look"].get("pieces", [])]}
    return public


def _catalog_favorite(item_id):
    if item_id in CATALOG_ITEMS:
        module, item = CATALOG_ITEMS[item_id]
        return {"kind": "style", "module": module, "title": item["title"], "category": item.get("category") or item.get("group"), "art": item["art"], "photo": item.get("photo"), "catalog": item["catalogs"][0]}
    if item_id in PRODUCTS:
        product = PRODUCTS[item_id]
        return {"kind": "product", "module": "skincare", "title": f"{product['brand']} {product['name']}", "category": product["category"], "art": None, "photo": product["image"].removeprefix("/assets/"), "catalog": None, "href": product["href"]}
    return None


def validate_look(data):
    """A look made only of catalog body items and valid colours. Returns (look, error)."""
    if not isinstance(data, dict):
        return None, "A look must be an object."
    pieces = []
    for piece in data.get("pieces") if isinstance(data.get("pieces"), list) else []:
        item_id = piece.get("item_id") if isinstance(piece, dict) else None
        hex_value = str(piece.get("hex") or "").upper() if isinstance(piece, dict) else ""
        if item_id not in CATALOG_ITEMS or CATALOG_ITEMS[item_id][0] != "body" or (hex_value and not HEX.match(hex_value)):
            return None, "A look can only contain pieces from our catalog."
        pieces.append({"item_id": item_id, "title": CATALOG_ITEMS[item_id][1]["title"], "art": CATALOG_ITEMS[item_id][1]["art"], **({"hex": hex_value} if hex_value else {})})
    if not 2 <= len(pieces) <= 6:
        return None, "A look needs between two and six pieces."
    title = clean(data.get("title"), 80)
    occasion = data.get("occasion") if data.get("occasion") in styling.CATALOG["occasion_labels"] else None
    if not title:
        return None, "A look needs a title."
    return {"title": title, "occasion": occasion, "pieces": pieces, "why": clean(data.get("why"), 400)}, None


@bp.get("/api/favorites")
@require_user
def list_favorites():
    # Beard & moustache styling was retired: older saved beard ideas stay in the database but are no longer shown.
    docs = style_favorites.find({"user_id": get_jwt_identity(), "item_id": {"$not": {"$regex": "^beard-"}}}, {"_id": 0}).sort("created_at", -1)
    return jsonify({"favorites": [_public(doc) for doc in docs]})


@bp.post("/api/favorites")
@require_user
def add_favorite():
    data = request.get_json(silent=True) or {}
    user_id = get_jwt_identity()
    result_id = str(data.get("result_id") or "")[:64] or None
    if data.get("look") is not None:
        look, error = validate_look(data["look"])
        if error:
            return jsonify({"error": error, "errorCode": "invalid_look"}), 400
        if style_favorites.count_documents({"user_id": user_id, "kind": "look"}) >= MAX_LOOKS:
            return jsonify({"error": "Your board already has 50 looks. Remove one to save another.", "errorCode": "too_many_looks"}), 400
        digest = hashlib.sha1(json.dumps([look["title"], look["pieces"]], sort_keys=True).encode()).hexdigest()[:12]
        fields = {"kind": "look", "module": "look", "item_id": f"look-{digest}", "title": look["title"], "category": look["occasion"], "art": look["pieces"][0]["art"], "look": look}
    else:
        item_id = str(data.get("item_id") or "")
        fields = _catalog_favorite(item_id)
        if not fields:
            return jsonify({"error": "That style isn't in our catalog.", "errorCode": "unknown_item"}), 400
        fields["item_id"] = item_id
    document = {"user_id": user_id, **fields, "result_id": result_id, "created_at": utc_now()}
    try:
        style_favorites.insert_one(document)
    except DuplicateKeyError:
        existing = style_favorites.find_one({"user_id": user_id, "item_id": fields["item_id"]}, {"_id": 0})
        return jsonify({"favorite": _public(existing)}), 200
    return jsonify({"favorite": _public(document)}), 201


@bp.delete("/api/favorites/<item_id>")
@require_user
def remove_favorite(item_id):
    style_favorites.delete_one({"user_id": get_jwt_identity(), "item_id": item_id})
    return jsonify({"message": "Removed from your saved styles."})

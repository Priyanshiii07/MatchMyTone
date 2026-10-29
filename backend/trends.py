"""Latest fashion and beauty coverage from publishers' official RSS feeds, matched to a saved result.

RSS feeds are published for syndication, so we show only the headline, publication date, a short
excerpt and a link back to the publisher. Each feed is cached in MongoDB for FEED_TTL_HOURS; a failed
refresh serves the last cached copy (labelled with its retrieval time). Items are matched to the
user's module and result by visible keywords, which are returned so the page can say why an article
was picked. Nothing is invented: when nothing matches, the page shows evergreen inspiration that is
clearly labelled as not current.
"""

import email.utils
import html
import json
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from models import trend_cache, utc_now

logger = logging.getLogger("matchmytone.trends")
FEEDS = {
    "vogue": {"publisher": "Vogue", "url": "https://www.vogue.com/feed/rss", "domain": "vogue.com", "audience": {"womenswear", "unisex", "mixed"}},
    "gq": {"publisher": "GQ", "url": "https://www.gq.com/feed/rss", "domain": "gq.com", "audience": {"menswear", "unisex", "mixed"}},
    "allure": {"publisher": "Allure", "url": "https://www.allure.com/feed/rss", "domain": "allure.com", "audience": {"womenswear", "unisex", "mixed", "menswear"}},
    "bazaar": {"publisher": "Harper's Bazaar", "url": "https://www.harpersbazaar.com/rss/all.xml/", "domain": "harpersbazaar.com", "audience": {"womenswear", "unisex", "mixed"}},
    "elle": {"publisher": "Elle", "url": "https://www.elle.com/rss/all.xml/", "domain": "elle.com", "audience": {"womenswear", "unisex", "mixed"}},
    "fashionista": {"publisher": "Fashionista", "url": "https://fashionista.com/.rss/full/", "domain": "fashionista.com", "audience": {"womenswear", "menswear", "unisex", "mixed"}},
}
FEED_TTL_HOURS = 6
MAX_FEED_BYTES = 3 * 1024 * 1024
MAX_AGE_DAYS = 45
FAILURE_BACKOFF_SECONDS = 1800
USER_AGENT = "MatchMyTone/1.0 (personal styling website; RSS reader)"
KEYWORDS = {
    "color_analysis": ["colour", "color", "palette", "shade", "pastel", "neutral", "monochrome", "burgundy", "olive", "camel", "navy", "terracotta", "ivory"],
    "skincare": ["skin care", "skincare", "skin-care", "serum", "sunscreen", "spf", "moisturiser", "moisturizer", "cleanser", "retinol", "niacinamide", "acne", "ceramide", "hyaluronic", "exfoliat", "dermatologist", "breakout", "razor bump", "shaving"],
    "face_shape": ["haircut", "hairstyle", "hair trend", "bangs", "bob", "pixie", "layered hair", "barber", "glasses", "sunglasses", "updo"],
    "body_shape": ["outfit", "trousers", "jeans", "denim", "dresses", "jacket", "blazer", "suits", "suiting", "tailoring", "silhouette", "skirt", "coat", "knitwear", "kurta", "saree", "sneakers", "loafers", "shirt", "what to wear"],
}
# Colour stories must also be about clothes, so nail and hair-colour pieces don't count.
REQUIRED_CONTEXT = {"color_analysis": ["outfit", "wear", "wardrobe", "dress", "suit", "knit", "coat", "jacket", "trousers", "jeans", "menswear", "womenswear"]}
# An item needs a title mention plus another hit, or three hits overall.
MIN_SCORE = 3
SKIN_WORDS = {"Oily Skin": ["oily", "oil control", "pores"], "Dry Skin": ["dry skin", "dehydrat", "hydrat"], "Combination Skin": ["combination"], "Sensitive Skin": ["sensitive", "redness", "barrier"], "Normal Skin": []}
EVERGREEN = json.loads(Path(__file__).with_name("evergreen_inspiration.json").read_text(encoding="utf-8"))
_failures = {}
_locks = {key: threading.Lock() for key in FEEDS}


def _text(node, tag):
    found = node.find(tag)
    return (found.text or "").strip() if found is not None and found.text else ""


def _plain(value, limit):
    value = re.sub(r"<[^>]+>", " ", html.unescape(value or ""))
    value = re.sub(r"\s+", " ", value).strip()
    return value if len(value) <= limit else value[:limit].rsplit(" ", 1)[0] + "…"


def parse_feed(raw, feed):
    """Items from one RSS document; links must be https on the publisher's own domain."""
    root = ElementTree.fromstring(raw)
    items = []
    for node in root.iter("item"):
        link = _text(node, "link")
        host = urlparse(link).hostname or ""
        if not link.startswith("https://") or not (host == feed["domain"] or host.endswith("." + feed["domain"])):
            continue
        published = None
        try:
            published = email.utils.parsedate_to_datetime(_text(node, "pubDate")).astimezone(timezone.utc).replace(tzinfo=None)
        except (TypeError, ValueError):
            pass
        title = _plain(_text(node, "title"), 160)
        if not title:
            continue
        categories = [_plain(c.text or "", 40) for c in node.findall("category") if c.text]
        items.append({"title": title, "url": link, "published_at": published, "summary": _plain(_text(node, "description"), 240), "categories": categories[:8]})
    return items


def _download(feed):
    request = Request(feed["url"], headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml;q=0.9"})
    with urlopen(request, timeout=10) as response:
        raw = response.read(MAX_FEED_BYTES + 1)
    if len(raw) > MAX_FEED_BYTES:
        raise ValueError("Feed too large")
    return raw


def feed_items(key):
    """Cached items for one feed, refreshed when older than FEED_TTL_HOURS. Returns (items, retrieved_at, stale)."""
    feed = FEEDS[key]
    cached = trend_cache.find_one({"key": f"feed:{key}"}, {"_id": 0})
    now = utc_now().replace(tzinfo=None)
    if cached and cached["retrieved_at"].replace(tzinfo=None) > now - timedelta(hours=FEED_TTL_HOURS):
        return cached["items"], cached["retrieved_at"], False
    if time.monotonic() < _failures.get(key, 0):
        return (cached["items"], cached["retrieved_at"], True) if cached else ([], None, True)
    with _locks[key]:
        try:
            items = parse_feed(_download(feed), feed)
        except (URLError, TimeoutError, OSError, ValueError, ElementTree.ParseError) as error:
            _failures[key] = time.monotonic() + FAILURE_BACKOFF_SECONDS
            logger.warning("Feed refresh failed feed=%s error=%s", key, type(error).__name__)
            return (cached["items"], cached["retrieved_at"], True) if cached else ([], None, True)
        trend_cache.update_one({"key": f"feed:{key}"}, {"$set": {"key": f"feed:{key}", "items": items, "retrieved_at": now}}, upsert=True)
        return items, now, False


def _terms(kind, doc):
    terms = list(KEYWORDS[kind])
    if kind == "skincare":
        terms += SKIN_WORDS.get((doc.get("plan") or {}).get("skin_type") or doc.get("result"), [])
    if kind == "face_shape" and doc.get("result"):
        terms.append(f"{doc['result'].lower()} face")
    return terms


def _mentions(term, text):
    return re.search(rf"\b{re.escape(term)}", text) is not None


def match(items, terms, limit=6, required=None):
    """Recent items clearly about the terms (a title mention weighs double), best and newest first."""
    cutoff = utc_now().replace(tzinfo=None) - timedelta(days=MAX_AGE_DAYS)
    scored = []
    for item in items:
        if item.get("published_at") and item["published_at"] < cutoff:
            continue
        haystack = " ".join([item["title"], item.get("summary", ""), " ".join(item.get("categories", []))]).lower()
        hits = [term for term in terms if _mentions(term, haystack)]
        if not hits or (required and not any(_mentions(term, haystack) for term in required)):
            continue
        score = len(hits) + 2 * sum(_mentions(term, item["title"].lower()) for term in hits)
        if score >= MIN_SCORE:
            scored.append((score, item.get("published_at") or cutoff, item, hits))
    scored.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
    return [(item, hits) for _, _, item, hits in scored[:limit]]


def _iso(moment):
    return moment.replace(tzinfo=None).isoformat(timespec="seconds") + "Z" if moment else None


def get_trends(kind, doc):
    """Latest matching articles for this result, plus labelled evergreen ideas when nothing matches."""
    catalog = (doc.get("styling") or {}).get("catalog") or "mixed"
    keys = [key for key, feed in FEEDS.items() if catalog in feed["audience"] or kind == "skincare"]
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        results = dict(zip(keys, pool.map(feed_items, keys)))
    terms = _terms(kind, doc)
    picked, sources = [], []
    for key, (items, retrieved, stale) in results.items():
        if retrieved:
            sources.append({"publisher": FEEDS[key]["publisher"], "retrieved_at": _iso(retrieved), "stale": stale})
        for item, hits in match(items, terms, limit=3, required=REQUIRED_CONTEXT.get(kind)):
            picked.append({"title": item["title"], "summary": item["summary"], "url": item["url"], "publisher": FEEDS[key]["publisher"], "published_at": _iso(item.get("published_at")), "matched": hits[:4]})
    picked.sort(key=lambda entry: entry["published_at"] or "", reverse=True)
    evergreen = EVERGREEN.get(kind, {}).get(catalog) or EVERGREEN.get(kind, {}).get("mixed", [])
    return {
        "status": "ok" if picked else ("no_matches" if sources else "unavailable"),
        "items": picked[:6],
        "sources": sources,
        "evergreen": [] if picked else evergreen,
        "note": "Latest articles from the publishers' official RSS feeds, matched to your result by keyword. They show what editors are covering now — not sales or popularity figures.",
    }

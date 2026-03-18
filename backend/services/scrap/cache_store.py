from __future__ import annotations
import json
import os
from datetime import datetime
from dataclasses import asdict
from services.scrap.base import MergedBook

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache_data")
CACHE_PATH = os.path.join(CACHE_DIR, "isbn_cache.json")

_EXPECTED_KEYS = {f.name for f in MergedBook.__dataclass_fields__.values()}


def _ensure_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)


def _load_raw() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {}
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def load() -> dict[str, MergedBook]:
    raw = _load_raw()
    result = {}
    for isbn, data in raw.items():
        safe = {k: data.get(k) for k in _EXPECTED_KEYS}
        try:
            result[isbn] = MergedBook(**safe)
        except TypeError:
            pass
    return result


def write(isbn: str, book: MergedBook) -> None:
    _ensure_dir()
    raw = _load_raw()
    entry = asdict(book)
    entry["cached_at"] = datetime.now().isoformat()
    raw[isbn] = entry
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)


def clear() -> None:
    if os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)


def stats() -> dict:
    raw = _load_raw()
    return {"total_cached": len(raw)}

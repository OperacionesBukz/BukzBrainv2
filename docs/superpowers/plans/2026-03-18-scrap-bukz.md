# Scrap Bukz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Scrap Bukz" module to BukzBrain that enriches book ISBNs with metadata from 5 Colombian bookstores, with a FastAPI backend and React frontend.

**Architecture:** Backend adds a new FastAPI router `/api/scrap/` to the existing Hostinger server. Scraping logic is migrated from `bukz-metadata-scraper` (Streamlit) as-is. Frontend creates a new page following the `ingreso/` module pattern (api.ts, types.ts, hooks.ts, components). Jobs run in background with polling for progress.

**Tech Stack:** FastAPI + ThreadPoolExecutor (backend), React + TanStack React Query + shadcn/ui (frontend)

**Spec:** `docs/superpowers/specs/2026-03-18-scrap-bukz-design.md`

---

## File Map

### Backend — New files

| File | Responsibility |
|------|---------------|
| `backend/routers/scrap.py` | FastAPI router with 6 endpoints under `/api/scrap/` |
| `backend/services/scrap/` | Directory for scraping logic |
| `backend/services/scrap/__init__.py` | Package init |
| `backend/services/scrap/base.py` | BookResult, MergedBook dataclasses, BookScraper ABC |
| `backend/services/scrap/isbn.py` | ISBN validation & normalization |
| `backend/services/scrap/cache_store.py` | JSON cache load/write/clear/stats |
| `backend/services/scrap/merger.py` | Merge results from 5 sources |
| `backend/services/scrap/runner.py` | Orchestrator: ThreadPoolExecutor + cache + progress callback |
| `backend/services/scrap/scrapers/__init__.py` | Package init |
| `backend/services/scrap/scrapers/casadellibro.py` | Casa del Libro API scraper |
| `backend/services/scrap/scrapers/vtex.py` | VTEX base scraper (Panamericana, Lerner) |
| `backend/services/scrap/scrapers/weblib.py` | Weblib base scraper (Tornamesa, Exlibris) |
| `backend/services/scrap/scrapers/panamericana.py` | Panamericana (extends VtexScraper) |
| `backend/services/scrap/scrapers/lerner.py` | Lerner (extends VtexScraper) |
| `backend/services/scrap/scrapers/tornamesa.py` | Tornamesa (extends WeblibScraper) |
| `backend/services/scrap/scrapers/exlibris.py` | Exlibris (extends WeblibScraper) |

### Backend — Modified files

| File | Change |
|------|--------|
| `backend/main.py` | Add `from routers import scrap` + `app.include_router(scrap.router)` |
| `backend/requirements.txt` | Add `beautifulsoup4>=4.12` |

### Frontend — New files

| File | Responsibility |
|------|---------------|
| `src/pages/scrap/types.ts` | API_BASE, interfaces (EnrichResponse, JobStatus, CacheStats) |
| `src/pages/scrap/api.ts` | Fetch wrappers for 6 endpoints |
| `src/pages/scrap/hooks.ts` | React Query hooks (useEnrich, useJobStatus, useCacheStats, useClearCache) |
| `src/pages/ScrapBukz.tsx` | Main page component |
| `src/pages/scrap/IsbnValidationSummary.tsx` | Shows valid/invalid ISBN counts |
| `src/pages/scrap/EnrichmentProgress.tsx` | Progress bar + live logs |
| `src/pages/scrap/ResultsTable.tsx` | Results table with stats + filter |

### Frontend — Modified files

| File | Change |
|------|--------|
| `src/App.tsx:22` | Add lazy import for ScrapBukz |
| `src/App.tsx:62` | Add route `<Route path="/scrap" element={<ScrapBukz />} />` |

---

## Task 1: Backend — Scraping service (migrated from Streamlit)

Migrate all scraping logic from `bukz-metadata-scraper/` into `backend/services/scrap/`. These files are copied with minimal changes: only import paths are updated.

**Files:**
- Create: `backend/services/scrap/__init__.py`
- Create: `backend/services/scrap/base.py`
- Create: `backend/services/scrap/isbn.py`
- Create: `backend/services/scrap/cache_store.py`
- Create: `backend/services/scrap/merger.py`
- Create: `backend/services/scrap/runner.py`
- Create: `backend/services/scrap/scrapers/__init__.py`
- Create: `backend/services/scrap/scrapers/casadellibro.py`
- Create: `backend/services/scrap/scrapers/vtex.py`
- Create: `backend/services/scrap/scrapers/weblib.py`
- Create: `backend/services/scrap/scrapers/panamericana.py`
- Create: `backend/services/scrap/scrapers/lerner.py`
- Create: `backend/services/scrap/scrapers/tornamesa.py`
- Create: `backend/services/scrap/scrapers/exlibris.py`

- [ ] **Step 1: Create `backend/services/scrap/__init__.py`**

```python
# empty init
```

- [ ] **Step 2: Create `backend/services/scrap/base.py`**

Copy from `bukz-metadata-scraper/scrapers/base.py` — identical content:

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class BookResult:
    source: str
    isbn: str
    titulo: Optional[str] = None
    autor: Optional[str] = None
    editorial: Optional[str] = None
    anio: Optional[int] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    portada_url: Optional[str] = None
    paginas: Optional[int] = None
    idioma: Optional[str] = None
    encuadernacion: Optional[str] = None
    found: bool = False
    error: Optional[str] = None


@dataclass
class MergedBook:
    isbn: str
    titulo: Optional[str] = None
    autor: Optional[str] = None
    editorial: Optional[str] = None
    anio: Optional[int] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    portada_url: Optional[str] = None
    paginas: Optional[int] = None
    idioma: Optional[str] = None
    encuadernacion: Optional[str] = None
    fuente_primaria: str = ""
    campos_encontrados: int = 0
    found: bool = False


class BookScraper(ABC):
    SOURCE_NAME: str = ""
    TIMEOUT: int = 10

    @abstractmethod
    def fetch(self, isbn: str) -> BookResult:
        """Fetch metadata for a given ISBN. Never raises — catch all exceptions."""
        ...
```

- [ ] **Step 3: Create `backend/services/scrap/isbn.py`**

Copy from `bukz-metadata-scraper/utils/isbn.py` — identical content:

```python
import re

def normalize_isbn(raw: str) -> str:
    """Strip hyphens/spaces, uppercase X."""
    cleaned = re.sub(r"[\s\-]", "", raw.strip()).upper()
    return cleaned

def _check_isbn13(digits: str) -> bool:
    if len(digits) != 13 or not digits.isdigit():
        return False
    total = sum(
        int(d) * (1 if i % 2 == 0 else 3)
        for i, d in enumerate(digits)
    )
    return total % 10 == 0

def _check_isbn10(digits: str) -> bool:
    if len(digits) != 10:
        return False
    if not digits[:9].isdigit():
        return False
    if digits[9] not in "0123456789X":
        return False
    total = sum(
        (10 if c == "X" else int(c)) * (10 - i)
        for i, c in enumerate(digits)
    )
    return total % 11 == 0

def validate_isbn(raw: str) -> bool:
    """Return True if raw is a valid ISBN-10 or ISBN-13."""
    normalized = normalize_isbn(raw)
    if len(normalized) == 13:
        return _check_isbn13(normalized)
    if len(normalized) == 10:
        return _check_isbn10(normalized)
    return False
```

- [ ] **Step 4: Create `backend/services/scrap/cache_store.py`**

Adapted from `bukz-metadata-scraper/cache/store.py` — only change: import path and CACHE_PATH location.

```python
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
    """Load all cached ISBNs. Forward-compat: missing keys default to None."""
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
```

- [ ] **Step 5: Create `backend/services/scrap/merger.py`**

Copy from `bukz-metadata-scraper/engine/merger.py` — only change: import path.

```python
from __future__ import annotations
import datetime
import statistics
from typing import Optional
from services.scrap.base import BookResult, MergedBook

SOURCE_PRIORITY = ["casadellibro", "panamericana", "lerner", "tornamesa", "exlibris"]

FIELDS = ["titulo", "autor", "editorial", "anio", "descripcion",
          "categoria", "portada_url", "paginas", "idioma", "encuadernacion"]


def _best_by_priority(values: list[tuple[str, object]]) -> Optional[object]:
    for source in SOURCE_PRIORITY:
        for s, v in values:
            if s == source and v is not None:
                return v
    for _, v in values:
        if v is not None:
            return v
    return None


def _merge_titulo(values: list[tuple[str, str]]) -> Optional[str]:
    candidates = [(s, v.strip().title()) for s, v in values if v]
    if not candidates:
        return None
    return max(candidates, key=lambda x: len(x[1]))[1]


def _merge_autor(values: list[tuple[str, str]]) -> Optional[str]:
    candidates = [(s, v.strip()) for s, v in values if v]
    if not candidates:
        return None
    structured = [(s, v) for s, v in candidates if "," in v or " de " in v.lower()]
    pool = structured or candidates
    return max(pool, key=lambda x: len(x[1]))[1]


def _merge_anio(values: list[tuple[str, int]]) -> Optional[int]:
    current_year = datetime.date.today().year
    valid = [v for _, v in values if isinstance(v, int) and 1900 <= v <= current_year + 1]
    if not valid:
        return None
    return valid[0]


def _merge_descripcion(values: list[tuple[str, str]]) -> Optional[str]:
    candidates = [(s, v.strip()) for s, v in values if v and len(v.strip()) > 0]
    if not candidates:
        return None
    return max(candidates, key=lambda x: len(x[1]))[1]


def _merge_paginas(values: list[tuple[str, int]]) -> Optional[int]:
    nums = [v for _, v in values if isinstance(v, int) and 0 < v < 5000]
    if not nums:
        fallback = next((v for _, v in values if v is not None), None)
        return int(fallback) if fallback is not None else None
    return int(round(statistics.median(nums)))


def merge(results: list[BookResult]) -> MergedBook:
    if not results:
        return MergedBook(isbn="", found=False)

    isbn = results[0].isbn

    def priority_key(r: BookResult) -> int:
        try:
            return SOURCE_PRIORITY.index(r.source)
        except ValueError:
            return 99

    sorted_results = sorted(results, key=priority_key)

    def vals(field: str) -> list[tuple[str, object]]:
        return [(r.source, getattr(r, field)) for r in sorted_results
                if getattr(r, field) is not None]

    titulo = _merge_titulo(vals("titulo"))
    autor = _merge_autor(vals("autor"))
    editorial = _best_by_priority(vals("editorial"))
    anio = _merge_anio(vals("anio"))
    descripcion = _merge_descripcion(vals("descripcion"))
    categoria = _best_by_priority(vals("categoria"))
    portada_url = _best_by_priority(vals("portada_url"))
    paginas = _merge_paginas(vals("paginas"))
    idioma = _best_by_priority(vals("idioma"))
    encuadernacion = _best_by_priority(vals("encuadernacion"))

    all_values = [titulo, autor, editorial, anio, descripcion,
                  categoria, portada_url, paginas, idioma, encuadernacion]
    campos = sum(1 for v in all_values if v is not None)
    found = any(r.found for r in results)
    fuente = sorted_results[0].source if sorted_results else ""

    return MergedBook(
        isbn=isbn,
        titulo=titulo, autor=autor, editorial=editorial, anio=anio,
        descripcion=descripcion, categoria=categoria, portada_url=portada_url,
        paginas=paginas, idioma=idioma, encuadernacion=encuadernacion,
        fuente_primaria=fuente,
        campos_encontrados=campos,
        found=found,
    )
```

- [ ] **Step 6: Create `backend/services/scrap/runner.py`**

Adapted from `bukz-metadata-scraper/engine/runner.py` — import paths updated, delay moved to per-ISBN after merge (not blocking threads).

```python
from __future__ import annotations
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from services.scrap.base import BookResult, MergedBook
from services.scrap.scrapers.tornamesa import TornameScraper
from services.scrap.scrapers.exlibris import ExlibrisScraper
from services.scrap.scrapers.panamericana import PanamericanaScraper
from services.scrap.scrapers.lerner import LernerScraper
from services.scrap.scrapers.casadellibro import CasaDelLibroScraper
from services.scrap.merger import merge
from services.scrap import cache_store as store

ALL_SCRAPERS = [
    CasaDelLibroScraper(),
    PanamericanaScraper(),
    LernerScraper(),
    TornameScraper(),
    ExlibrisScraper(),
]


def run(
    isbn_list: list[str],
    delay: float = 0.3,
    progress_cb: Callable[[str, MergedBook], None] | None = None,
) -> list[MergedBook]:
    cache = store.load()
    results: list[MergedBook] = []
    uncached = [isbn for isbn in isbn_list if isbn not in cache]

    for isbn in isbn_list:
        if isbn in cache:
            book = cache[isbn]
            if progress_cb:
                progress_cb(isbn, book)
            results.append(book)

    if not uncached:
        return results

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_key: dict = {
            executor.submit(scraper.fetch, isbn): (isbn, scraper.SOURCE_NAME)
            for isbn in uncached
            for scraper in ALL_SCRAPERS
        }

        results_by_isbn: dict[str, list[BookResult]] = {isbn: [] for isbn in uncached}
        for future in as_completed(future_to_key):
            isbn, source = future_to_key[future]
            try:
                results_by_isbn[isbn].append(future.result())
            except Exception as e:
                results_by_isbn[isbn].append(
                    BookResult(source=source, isbn=isbn, error=str(e))
                )

    for isbn in uncached:
        merged = merge(results_by_isbn[isbn])
        store.write(isbn, merged)
        if progress_cb:
            progress_cb(isbn, merged)
        results.append(merged)
        if delay > 0:
            time.sleep(delay)

    return results
```

- [ ] **Step 7: Create scraper files**

Create `backend/services/scrap/scrapers/__init__.py` (empty).

Create `backend/services/scrap/scrapers/casadellibro.py` — only import path changes:

```python
from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper


class CasaDelLibroScraper(BookScraper):
    SOURCE_NAME = "casadellibro"
    API_URL = "https://api.empathy.co/search/v1/query/cdl/search"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            params = {
                "query": isbn, "start": 0, "rows": 5, "instance": "cdl",
                "lang": "es", "scope": "desktop", "currency": "EUR",
                "store": "CO", "facets": "false", "internal": "true",
            }
            r = requests.get(self.API_URL, params=params, timeout=self.TIMEOUT,
                             headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            data = r.json()
            items = data.get("catalog", {}).get("content", [])
            if not items:
                return result
            p = items[0]
            result.found = True
            result.titulo = p.get("name") or p.get("__name")
            result.autor = (p.get("author") or p.get("autor")
                            or p.get("author1")
                            or (p.get("authors") or [None])[0])
            result.portada_url = p.get("image") or (p.get("__images") or [None])[0]
            result.descripcion = p.get("description") or p.get("longDescription")
            editorial_raw = p.get("publisher") or p.get("editorial") or ""
            result.editorial = editorial_raw.strip() or None
            result.idioma = p.get("language") or p.get("idioma")
            result.encuadernacion = p.get("binding") or p.get("encuadernacion")
            result.categoria = p.get("category") or p.get("categories", [None])[0]
            anio_raw = p.get("yearPublication") or p.get("year") or p.get("publishYear") or p.get("ano")
            if anio_raw:
                m = re.search(r"\b(19|20)\d{2}\b", str(anio_raw))
                if m:
                    result.anio = int(m.group())
            paginas_raw = p.get("pages") or p.get("numPages") or p.get("paginas")
            if paginas_raw:
                m = re.search(r"\d+", str(paginas_raw))
                if m:
                    result.paginas = int(m.group())
        except Exception as e:
            result.error = str(e)
        return result
```

Create `backend/services/scrap/scrapers/vtex.py` — only import path changes:

```python
from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper


class VtexScraper(BookScraper):
    BASE_URL: str = ""

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            url = f"{self.BASE_URL}/_v/api/intelligent-search/product_search"
            params = {"query": isbn, "page": 1, "count": 5, "locale": "es-CO"}
            r = requests.get(url, params=params, timeout=self.TIMEOUT,
                             headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            data = r.json()
            products = data.get("products", [])
            if not products:
                return result
            p = products[0]
            result.found = True
            result.titulo = p.get("productName")
            result.descripcion = p.get("description") or p.get("metaTagDescription")
            props = {
                prop["name"].lower(): prop["values"][0]
                for prop in p.get("properties", [])
                if prop.get("values")
            }
            editorial_prop = props.get("editorial")
            brand = (p.get("brand") or "").strip()
            result.editorial = editorial_prop or brand or None
            result.autor = props.get("autor") or props.get("author")
            result.idioma = props.get("idioma") or props.get("language")
            result.encuadernacion = (props.get("encuadernación")
                                     or props.get("encuadernacion")
                                     or props.get("presentación")
                                     or props.get("presentacion"))
            categories = p.get("categories") or []
            if categories:
                longest = max(categories, key=len)
                segments = [s.strip() for s in longest.strip("/").split("/") if s.strip()]
                if segments:
                    result.categoria = segments[-1]
            if not result.categoria:
                result.categoria = (props.get("categoria") or props.get("category")
                                    or props.get("tematica") or props.get("temática"))
            anio_raw = (props.get("año") or props.get("year")
                        or props.get("año de publicación")
                        or props.get("fecha de publicación")
                        or props.get("fecha de edición"))
            if anio_raw:
                m = re.search(r"\b(19|20)\d{2}\b", str(anio_raw))
                if m:
                    result.anio = int(m.group())
            paginas_raw = (props.get("páginas") or props.get("paginas")
                           or props.get("número de páginas")
                           or props.get("n° paginas") or props.get("nº paginas"))
            if paginas_raw:
                m = re.search(r"\d+", str(paginas_raw))
                if m:
                    result.paginas = int(m.group())
            items = p.get("items", [])
            if items:
                images = items[0].get("images", [])
                if images:
                    result.portada_url = images[0].get("imageUrl")
        except Exception as e:
            result.error = str(e)
        return result
```

Create `backend/services/scrap/scrapers/weblib.py` — only import path changes:

```python
from __future__ import annotations
import re
import requests
from bs4 import BeautifulSoup
from services.scrap.base import BookResult, BookScraper


class WeblibScraper(BookScraper):
    BASE_URL: str = ""

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            search_url = f"{self.BASE_URL}/busqueda/listaLibros.php"
            params = {"tipoBus": "full", "palabrasBusqueda": isbn}
            r = requests.get(search_url, params=params, timeout=self.TIMEOUT,
                             headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            items = soup.select(".content li.item")
            if not items:
                return result
            item = items[0]
            result.found = True
            a = item.select_one("a.productClick")
            if a:
                result.titulo = a.get("data-name", "").strip() or None
            img = item.select_one("img")
            if img and img.get("src"):
                result.portada_url = img["src"]
                match = re.search(r"/imagenes/\d+/(\d{12})", img["src"])
                if match:
                    result.isbn = match.group(1)
            product_path = a.get("href") if a else None
            if product_path:
                detail_url = self.BASE_URL + product_path
                rd = requests.get(detail_url, timeout=self.TIMEOUT,
                                  headers={"User-Agent": "Mozilla/5.0"})
                rd.raise_for_status()
                ds = BeautifulSoup(rd.text, "html.parser")
                result = self._parse_detail(ds, result)
        except Exception as e:
            result.error = str(e)
        return result

    def _parse_detail(self, soup: BeautifulSoup, result: BookResult) -> BookResult:
        def get_dd(label: str) -> str | None:
            dt = soup.find("dt", string=re.compile(label, re.IGNORECASE))
            if dt:
                dd = dt.find_next_sibling("dd")
                return dd.get_text(strip=True) if dd else None
            return None

        result.autor = get_dd("autor") or result.autor
        result.editorial = get_dd("editorial") or result.editorial
        result.idioma = get_dd("idioma") or result.idioma
        result.encuadernacion = get_dd("encuadernaci") or get_dd("cubierta") or result.encuadernacion
        anio_raw = get_dd("año") or get_dd("fecha")
        if anio_raw:
            m = re.search(r"\b(19|20)\d{2}\b", anio_raw)
            if m:
                result.anio = int(m.group())
        paginas_raw = get_dd("páginas") or get_dd("paginas")
        if paginas_raw:
            m = re.search(r"\d+", paginas_raw)
            if m:
                result.paginas = int(m.group())
        desc_el = soup.select_one("#descripcion, .descripcion, .sinopsis")
        if desc_el:
            result.descripcion = desc_el.get_text(separator=" ", strip=True) or None
        result.categoria = get_dd("materia") or get_dd("tema") or result.categoria
        if not result.categoria:
            cat_el = soup.select_one(".categoria, .breadcrumb a:last-child")
            if cat_el:
                result.categoria = cat_el.get_text(strip=True) or None
        return result
```

Create 4 small scraper subclass files:

`backend/services/scrap/scrapers/panamericana.py`:
```python
from services.scrap.scrapers.vtex import VtexScraper

class PanamericanaScraper(VtexScraper):
    SOURCE_NAME = "panamericana"
    BASE_URL = "https://www.panamericana.com.co"
```

`backend/services/scrap/scrapers/lerner.py`:
```python
from services.scrap.scrapers.vtex import VtexScraper

class LernerScraper(VtexScraper):
    SOURCE_NAME = "lerner"
    BASE_URL = "https://www.librerialerner.com.co"
```

`backend/services/scrap/scrapers/tornamesa.py`:
```python
from services.scrap.scrapers.weblib import WeblibScraper

class TornameScraper(WeblibScraper):
    SOURCE_NAME = "tornamesa"
    BASE_URL = "https://www.tornamesa.co"
```

`backend/services/scrap/scrapers/exlibris.py`:
```python
from services.scrap.scrapers.weblib import WeblibScraper

class ExlibrisScraper(WeblibScraper):
    SOURCE_NAME = "exlibris"
    BASE_URL = "https://www.exlibris.com.co"
```

- [ ] **Step 8: Commit backend scraping service**

```bash
git add backend/services/scrap/
git commit -m "feat(scrap): migrate scraping service from bukz-metadata-scraper

Copies scrapers, merger, runner, cache, and ISBN validation
into backend/services/scrap/ with updated import paths."
```

---

## Task 2: Backend — FastAPI router + job system

Create the `/api/scrap/` router with background job management.

**Files:**
- Create: `backend/routers/scrap.py`
- Modify: `backend/main.py:9,27`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Create `backend/routers/scrap.py`**

```python
"""
Router para el módulo Scrap Bukz — enriquecimiento de metadatos de libros.
"""
from __future__ import annotations
import io
import os
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse

from services.scrap.isbn import validate_isbn, normalize_isbn
from services.scrap.runner import run as run_scraper
from services.scrap.base import MergedBook
from services.scrap import cache_store

router = APIRouter(prefix="/api/scrap", tags=["Scrap Bukz"])

# ── Job management ─────────────────────────────────────────────────────────

@dataclass
class ScrapJob:
    job_id: str
    status: str = "processing"  # processing | completed | error
    total: int = 0
    processed: int = 0
    logs: list[str] = field(default_factory=list)
    error: Optional[str] = None
    result_path: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


_jobs: dict[str, ScrapJob] = {}
_jobs_lock = threading.Lock()

JOB_TTL = timedelta(hours=1)
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "tmp_scrap")


def _cleanup_old_jobs():
    """Remove jobs older than JOB_TTL."""
    now = datetime.now()
    with _jobs_lock:
        expired = [jid for jid, job in _jobs.items()
                   if now - job.created_at > JOB_TTL]
        for jid in expired:
            job = _jobs.pop(jid)
            if job.result_path and os.path.exists(job.result_path):
                os.remove(job.result_path)


def _get_job(job_id: str) -> ScrapJob:
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job


# ── ISBN detection from DataFrame ──────────────────────────────────────────

ISBN_COLUMN_NAMES = {"isbn", "ean", "isbn13", "isbn_13"}


def _detect_isbn_column(df: pd.DataFrame) -> Optional[str]:
    """Auto-detect the ISBN column by name or content pattern."""
    for col in df.columns:
        if col.strip().lower() in ISBN_COLUMN_NAMES:
            return col
    for col in df.columns:
        sample = df[col].dropna().head(10).astype(str)
        if sample.str.match(r"^\d{13}$").mean() > 0.5:
            return col
    return None


# ── Background task ────────────────────────────────────────────────────────

META_COLS = [
    "titulo", "autor", "editorial", "anio", "descripcion",
    "categoria", "portada_url", "paginas", "idioma",
    "encuadernacion", "fuente_primaria", "campos_encontrados",
]


def _run_enrichment(
    job: ScrapJob,
    df_original: pd.DataFrame,
    isbn_col: str,
    valid_isbns: list[str],
    delay: float,
):
    """Runs in a background thread. Updates job state as it progresses."""
    try:
        def on_progress(isbn: str, book: MergedBook):
            with _jobs_lock:
                job.processed += 1
                if book.found:
                    icon = "ok" if book.campos_encontrados >= 5 else "parcial"
                    job.logs.append(
                        f"{icon}|{isbn}|{book.fuente_primaria}|{book.campos_encontrados}/10"
                    )
                else:
                    job.logs.append(f"no|{isbn}||0/10")

        books = run_scraper(valid_isbns, delay=delay, progress_cb=on_progress)

        # Build result DataFrame
        books_dict = {b.isbn: b for b in books}
        rows = []
        for _, row in df_original.iterrows():
            isbn_raw = str(row[isbn_col]).strip()
            norm = normalize_isbn(isbn_raw) if validate_isbn(isbn_raw) else None
            book = books_dict.get(norm) if norm else None
            meta = {col: getattr(book, col, None) if book else None for col in META_COLS}
            rows.append({**row.to_dict(), **meta})

        df_result = pd.DataFrame(rows)

        # Save to temp Excel
        os.makedirs(TEMP_DIR, exist_ok=True)
        result_path = os.path.join(TEMP_DIR, f"{job.job_id}.xlsx")
        with pd.ExcelWriter(result_path, engine="openpyxl") as writer:
            df_result.to_excel(writer, index=False)

        with _jobs_lock:
            job.result_path = result_path
            job.status = "completed"

    except Exception as e:
        with _jobs_lock:
            job.status = "error"
            job.error = str(e)


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/enrich")
async def enrich(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    delay: float = Query(0.3, ge=0.0, le=2.0),
):
    """Upload Excel/CSV, validate ISBNs, start enrichment job."""
    _cleanup_old_jobs()

    # Read file
    content = await file.read()
    filename = file.filename or ""
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo archivo: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Detect ISBN column
    isbn_col = _detect_isbn_column(df)
    if isbn_col is None:
        raise HTTPException(
            status_code=400,
            detail=f"No se detectó columna ISBN. Columnas disponibles: {list(df.columns)}",
        )

    # Validate ISBNs
    df["_isbn_raw"] = df[isbn_col].astype(str).str.strip()
    df["_isbn_norm"] = df["_isbn_raw"].apply(
        lambda x: normalize_isbn(x) if validate_isbn(x) else None
    )
    valid_mask = df["_isbn_norm"].notna()
    valid_isbns = df.loc[valid_mask, "_isbn_norm"].tolist()
    invalid_isbns = df.loc[~valid_mask, isbn_col].tolist()

    # Remove helper columns from the df we'll process
    df_clean = df.drop(columns=["_isbn_raw", "_isbn_norm"])

    if not valid_isbns:
        raise HTTPException(status_code=400, detail="No se encontraron ISBNs válidos")

    # Create job
    job_id = str(uuid.uuid4())
    job = ScrapJob(job_id=job_id, total=len(valid_isbns))
    with _jobs_lock:
        _jobs[job_id] = job

    # Start background enrichment
    background_tasks.add_task(
        _run_enrichment, job, df_clean, isbn_col, valid_isbns, delay
    )

    return {
        "job_id": job_id,
        "total_isbns": len(valid_isbns),
        "invalid_isbns": invalid_isbns,
        "valid_count": len(valid_isbns),
        "isbn_column": isbn_col,
    }


@router.get("/status/{job_id}")
def job_status(job_id: str):
    """Poll job progress."""
    job = _get_job(job_id)
    return {
        "status": job.status,
        "processed": job.processed,
        "total": job.total,
        "logs": job.logs,
        "error": job.error,
    }


@router.get("/download/{job_id}")
def download_result(job_id: str):
    """Download enriched Excel when job is completed."""
    job = _get_job(job_id)
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="El job aún no ha terminado")
    if not job.result_path or not os.path.exists(job.result_path):
        raise HTTPException(status_code=404, detail="Archivo de resultado no encontrado")

    def iterfile():
        with open(job.result_path, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=libros_enriquecidos.xlsx"},
    )


@router.get("/cache/stats")
def get_cache_stats():
    return cache_store.stats()


@router.delete("/cache/clear")
def clear_cache():
    cache_store.clear()
    return {"success": True}
```

- [ ] **Step 2: Register router in `backend/main.py`**

Add after line 9 (`from routers import ingreso`):

```python
from routers import scrap
```

Add after line 27 (`app.include_router(ingreso.router)`):

```python
app.include_router(scrap.router)
```

- [ ] **Step 3: Add beautifulsoup4 to `backend/requirements.txt`**

Add at end:

```
beautifulsoup4>=4.12
```

- [ ] **Step 4: Commit backend router**

```bash
git add backend/routers/scrap.py backend/main.py backend/requirements.txt
git commit -m "feat(scrap): add /api/scrap/ router with background job system

Endpoints: health, enrich (POST), status polling, download,
cache stats, cache clear. Uses BackgroundTasks for async processing."
```

---

## Task 3: Frontend — types.ts, api.ts, hooks.ts

Create the data layer following the ingreso module pattern exactly.

**Files:**
- Create: `src/pages/scrap/types.ts`
- Create: `src/pages/scrap/api.ts`
- Create: `src/pages/scrap/hooks.ts`

- [ ] **Step 1: Create `src/pages/scrap/types.ts`**

```typescript
export { API_BASE } from "../ingreso/types";

export interface EnrichResponse {
  job_id: string;
  total_isbns: number;
  invalid_isbns: string[];
  valid_count: number;
  isbn_column: string;
}

export interface JobStatus {
  status: "processing" | "completed" | "error";
  processed: number;
  total: number;
  logs: string[];
  error: string | null;
}

export interface CacheStats {
  total_cached: number;
}
```

- [ ] **Step 2: Create `src/pages/scrap/api.ts`**

```typescript
import { API_BASE, type EnrichResponse, type JobStatus, type CacheStats } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

async function handleBlobResponse(response: Response): Promise<Blob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
  }
  return response.blob();
}

// Health
export async function healthCheck(): Promise<{ status: string }> {
  return handleResponse(await fetch(`${API_BASE}/api/scrap/health`));
}

// Enrich
export async function enrich(file: File, delay: number = 0.3): Promise<EnrichResponse> {
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ delay: String(delay) });
  return handleResponse(
    await fetch(`${API_BASE}/api/scrap/enrich?${params}`, {
      method: "POST",
      body: form,
    }),
  );
}

// Status polling
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return handleResponse(await fetch(`${API_BASE}/api/scrap/status/${jobId}`));
}

// Download result
export async function downloadResult(jobId: string): Promise<Blob> {
  return handleBlobResponse(await fetch(`${API_BASE}/api/scrap/download/${jobId}`));
}

// Cache
export async function getCacheStats(): Promise<CacheStats> {
  return handleResponse(await fetch(`${API_BASE}/api/scrap/cache/stats`));
}

export async function clearCache(): Promise<{ success: boolean }> {
  return handleResponse(
    await fetch(`${API_BASE}/api/scrap/cache/clear`, { method: "DELETE" }),
  );
}

// Helpers
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Create `src/pages/scrap/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  healthCheck,
  enrich,
  getJobStatus,
  downloadResult,
  getCacheStats,
  clearCache,
  downloadBlob,
} from "./api";

export function useScrapHealth() {
  return useQuery({
    queryKey: ["scrap", "health"],
    queryFn: healthCheck,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useEnrich() {
  return useMutation({
    mutationFn: ({ file, delay }: { file: File; delay: number }) =>
      enrich(file, delay),
  });
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["scrap", "status", jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status !== "processing") return false;
      return 2000;
    },
  });
}

export function useDownloadResult() {
  return useMutation({
    mutationFn: (jobId: string) => downloadResult(jobId),
    onSuccess: (blob) => {
      downloadBlob(blob, "libros_enriquecidos.xlsx");
    },
  });
}

export function useCacheStats() {
  return useQuery({
    queryKey: ["scrap", "cache", "stats"],
    queryFn: getCacheStats,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClearCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearCache,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scrap", "cache", "stats"] });
    },
  });
}
```

- [ ] **Step 4: Commit frontend data layer**

```bash
git add src/pages/scrap/
git commit -m "feat(scrap): add frontend data layer (types, api, hooks)

Follows ingreso module pattern: fetch wrappers, React Query hooks
with 2s polling for job status."
```

---

## Task 4: Frontend — Main page component (ScrapBukz.tsx)

Create the main page with the full enrichment flow.

**Files:**
- Create: `src/pages/ScrapBukz.tsx`
- Create: `src/pages/scrap/IsbnValidationSummary.tsx`
- Create: `src/pages/scrap/EnrichmentProgress.tsx`
- Create: `src/pages/scrap/ResultsTable.tsx`

- [ ] **Step 1: Create `src/pages/scrap/IsbnValidationSummary.tsx`**

```typescript
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface IsbnValidationSummaryProps {
  validCount: number;
  invalidIsbns: string[];
  isbnColumn: string;
}

export default function IsbnValidationSummary({
  validCount,
  invalidIsbns,
  isbnColumn,
}: IsbnValidationSummaryProps) {
  return (
    <div className="space-y-3">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <strong>{validCount}</strong> ISBNs válidos detectados en columna{" "}
          <Badge variant="secondary">{isbnColumn}</Badge>
        </AlertDescription>
      </Alert>
      {invalidIsbns.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{invalidIsbns.length}</strong> ISBNs inválidos (serán omitidos)
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">
                Ver ISBNs inválidos
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs font-mono">
                {invalidIsbns.map((isbn, i) => (
                  <div key={i}>{isbn}</div>
                ))}
              </div>
            </details>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/scrap/EnrichmentProgress.tsx`**

```typescript
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JobStatus } from "./types";

interface EnrichmentProgressProps {
  jobStatus: JobStatus;
}

function LogIcon({ type }: { type: string }) {
  if (type === "ok") return <span className="text-green-500">●</span>;
  if (type === "parcial") return <span className="text-yellow-500">●</span>;
  return <span className="text-red-500">●</span>;
}

export default function EnrichmentProgress({ jobStatus }: EnrichmentProgressProps) {
  const pct = jobStatus.total > 0
    ? Math.round((jobStatus.processed / jobStatus.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {jobStatus.status === "processing" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Procesando ISBNs — {jobStatus.processed} / {jobStatus.total}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} className="h-2" />
        <ScrollArea className="h-48 rounded border p-3">
          <div className="space-y-1 font-mono text-xs">
            {jobStatus.logs.map((log, i) => {
              const [type, isbn, source, campos] = log.split("|");
              return (
                <div key={i} className="flex items-center gap-2">
                  <LogIcon type={type} />
                  <span className="text-muted-foreground">{isbn}</span>
                  {source && (
                    <span className="text-foreground">— {source}</span>
                  )}
                  {campos && (
                    <span className="text-muted-foreground">({campos})</span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `src/pages/scrap/ResultsTable.tsx`**

```typescript
import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { JobStatus } from "./types";

interface ResultsTableProps {
  jobStatus: JobStatus;
  onDownloadExcel: () => void;
  isDownloading: boolean;
}

export default function ResultsTable({
  jobStatus,
  onDownloadExcel,
  isDownloading,
}: ResultsTableProps) {
  const [showIncomplete, setShowIncomplete] = useState(false);

  const logs = jobStatus.logs;
  const completos = logs.filter((l) => l.startsWith("ok|")).length;
  const parciales = logs.filter((l) => l.startsWith("parcial|")).length;
  const noEncontrados = logs.filter((l) => l.startsWith("no|")).length;

  const displayLogs = showIncomplete
    ? logs.filter((l) => !l.startsWith("ok|"))
    : logs;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resultados</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-incomplete"
                checked={showIncomplete}
                onCheckedChange={setShowIncomplete}
              />
              <Label htmlFor="show-incomplete" className="text-sm">
                Solo incompletos
              </Label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="default">{completos} completos</Badge>
          <Badge variant="secondary">{parciales} parciales</Badge>
          <Badge variant="destructive">{noEncontrados} no encontrados</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">ISBN</th>
                <th className="text-left px-3 py-2">Fuente</th>
                <th className="text-left px-3 py-2">Campos</th>
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log, i) => {
                const [type, isbn, source, campos] = log.split("|");
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">
                      {type === "ok" && <span className="text-green-500">Completo</span>}
                      {type === "parcial" && <span className="text-yellow-500">Parcial</span>}
                      {type === "no" && <span className="text-red-500">No encontrado</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{isbn}</td>
                    <td className="px-3 py-1.5">{source || "—"}</td>
                    <td className="px-3 py-1.5">{campos || "0/10"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button onClick={onDownloadExcel} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? "Descargando..." : "Descargar Excel enriquecido"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `src/pages/ScrapBukz.tsx`**

```typescript
import { useState } from "react";
import { AlertCircle, RefreshCw, Search, Trash2, Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import FileUploadZone from "./ingreso/FileUploadZone";
import IsbnValidationSummary from "./scrap/IsbnValidationSummary";
import EnrichmentProgress from "./scrap/EnrichmentProgress";
import ResultsTable from "./scrap/ResultsTable";
import {
  useScrapHealth,
  useEnrich,
  useJobStatus,
  useDownloadResult,
  useCacheStats,
  useClearCache,
} from "./scrap/hooks";
import type { EnrichResponse } from "./scrap/types";

export default function ScrapBukz() {
  const health = useScrapHealth();
  const enrichMutation = useEnrich();
  const downloadMutation = useDownloadResult();
  const cacheStats = useCacheStats();
  const clearCacheMutation = useClearCache();

  const [file, setFile] = useState<File | null>(null);
  const [delay, setDelay] = useState(0.3);
  const [enrichResult, setEnrichResult] = useState<EnrichResponse | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const jobStatus = useJobStatus(jobId);

  const handleFileSelected = (f: File) => {
    setFile(f);
    setEnrichResult(null);
    setJobId(null);
  };

  const handleEnrich = () => {
    if (!file) return;
    enrichMutation.mutate(
      { file, delay },
      {
        onSuccess: (data) => {
          setEnrichResult(data);
          setJobId(data.job_id);
        },
      },
    );
  };

  const handleReset = () => {
    setFile(null);
    setEnrichResult(null);
    setJobId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Scrap Bukz</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Enriquecimiento de metadatos de libros por ISBN
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>Caché: {cacheStats.data?.total_cached ?? 0} ISBNs</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {health.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : health.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor.
            <Button variant="outline" size="sm" onClick={() => health.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Upload */}
          {!enrichResult && (
            <>
              <FileUploadZone
                title="Sube tu archivo con ISBNs"
                hint="Arrastra un archivo CSV o Excel (.xlsx)"
                accept=".csv,.xlsx,.xls"
                fileName={file?.name}
                isLoaded={!!file}
                onFileSelected={handleFileSelected}
              />

              {file && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm whitespace-nowrap">
                        Delay entre ISBNs: {delay.toFixed(1)}s
                      </Label>
                      <Slider
                        value={[delay]}
                        onValueChange={([v]) => setDelay(v)}
                        min={0}
                        max={2}
                        step={0.1}
                        className="max-w-xs"
                      />
                    </div>
                    <Button
                      onClick={handleEnrich}
                      disabled={enrichMutation.isPending}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      {enrichMutation.isPending
                        ? "Enviando..."
                        : "Enriquecer metadatos"}
                    </Button>
                    {enrichMutation.isError && (
                      <p className="text-sm text-destructive">
                        {enrichMutation.error.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Step 2: Validation summary */}
          {enrichResult && (
            <IsbnValidationSummary
              validCount={enrichResult.valid_count}
              invalidIsbns={enrichResult.invalid_isbns}
              isbnColumn={enrichResult.isbn_column}
            />
          )}

          {/* Step 3: Progress */}
          {jobId && jobStatus.data && jobStatus.data.status === "processing" && (
            <EnrichmentProgress jobStatus={jobStatus.data} />
          )}

          {/* Step 4: Error */}
          {jobStatus.data?.status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error en el procesamiento</AlertTitle>
              <AlertDescription>{jobStatus.data.error}</AlertDescription>
            </Alert>
          )}

          {/* Step 5: Results */}
          {jobStatus.data?.status === "completed" && (
            <>
              <ResultsTable
                jobStatus={jobStatus.data}
                onDownloadExcel={() => downloadMutation.mutate(jobId!)}
                isDownloading={downloadMutation.isPending}
              />
              <Button variant="outline" onClick={handleReset}>
                Procesar otro archivo
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit frontend components**

```bash
git add src/pages/ScrapBukz.tsx src/pages/scrap/
git commit -m "feat(scrap): add ScrapBukz page with upload, progress, and results

Full enrichment flow: file upload, ISBN validation, live progress
polling, results table with stats, and Excel download."
```

---

## Task 5: Frontend — Route registration in App.tsx

**Files:**
- Modify: `src/App.tsx:22,62`

- [ ] **Step 1: Add lazy import in `src/App.tsx`**

After line 22 (`const IngresoMercancia = lazy(...)`) add:

```typescript
const ScrapBukz = lazy(() => import("./pages/ScrapBukz"));
```

- [ ] **Step 2: Add route in `src/App.tsx`**

After line 62 (`<Route path="/ingreso" element={<IngresoMercancia />} />`) add:

```typescript
<Route path="/scrap" element={<ScrapBukz />} />
```

- [ ] **Step 3: Commit route registration**

```bash
git add src/App.tsx
git commit -m "feat(scrap): register /scrap route in App.tsx"
```

---

## Task 6: Build verification

Verify the frontend compiles without errors.

- [ ] **Step 1: Run TypeScript build check**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Fix any build errors if they occur**

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(scrap): resolve build errors"
```

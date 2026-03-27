from __future__ import annotations
import json
import re
import requests
from bs4 import BeautifulSoup
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


class PenguinRandomHouseScraper(BookScraper):
    SOURCE_NAME = "penguinrandomhouse"
    SEARCH_URL = "https://www.penguinrandomhouse.com/search/site"
    COVER_URL = "https://images2.penguinrandomhouse.com/cover"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            r = requests.get(
                self.SEARCH_URL,
                params={"q": isbn},
                timeout=self.TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
                allow_redirects=True,
            )
            r.raise_for_status()
            html = r.text

            if "no-results" in html.lower() or "Product Detail Page" not in html:
                return result

            utag = self._extract_utag(html)
            if utag:
                product_isbns = utag.get("product_isbn", [])
                if isinstance(product_isbns, list):
                    isbn_strs = [str(i) for i in product_isbns]
                else:
                    isbn_strs = [str(product_isbns)]
                if isbn_strs and not any(isbn_match(isbn, fi) for fi in isbn_strs):
                    return result

            fmt = self._extract_format(html, isbn)
            if not utag and not fmt:
                return result
            result.found = True
            soup = BeautifulSoup(html, "html.parser")

            if fmt:
                result.titulo = fmt.get("title")
                subtitle = fmt.get("subtitle")
                if subtitle and result.titulo and subtitle not in result.titulo:
                    result.titulo = f"{result.titulo}: {subtitle}"
                result.autor = fmt.get("author")
                imprint = fmt.get("imprint")
                if isinstance(imprint, dict):
                    result.editorial = imprint.get("name")
                elif isinstance(imprint, str):
                    result.editorial = imprint
                on_sale = fmt.get("onSaleDate")
                if isinstance(on_sale, dict):
                    on_sale = on_sale.get("date", "")
                if on_sale:
                    m = re.search(r"\b(19|20)\d{2}\b", str(on_sale))
                    if m:
                        result.anio = int(m.group())
                pages = fmt.get("totalPages")
                if pages:
                    try:
                        result.paginas = int(pages)
                    except (ValueError, TypeError):
                        pass
                fmt_obj = fmt.get("format")
                if isinstance(fmt_obj, dict):
                    result.encuadernacion = fmt_obj.get("name")
                elif isinstance(fmt_obj, str):
                    result.encuadernacion = fmt_obj

            if utag:
                if not result.titulo:
                    titles = utag.get("product_title", [])
                    if titles:
                        result.titulo = titles[0] if isinstance(titles, list) else titles
                if not result.autor:
                    authors = utag.get("product_author", [])
                    if authors:
                        val = authors[0] if isinstance(authors, list) else authors
                        result.autor = val.replace(" | ", ", ")
                if not result.editorial:
                    imprints = utag.get("product_imprint", [])
                    if imprints:
                        result.editorial = imprints[0] if isinstance(imprints, list) else imprints
                cats = utag.get("product_category", [])
                if cats:
                    val = cats[0] if isinstance(cats, list) else cats
                    parts = [c.strip() for c in val.split("|") if c.strip()]
                    if parts:
                        result.categoria = parts[0]
                if not result.encuadernacion:
                    fmts = utag.get("product_format", [])
                    if fmts:
                        result.encuadernacion = fmts[0] if isinstance(fmts, list) else fmts

            desc_el = soup.select_one(
                ".description-text, .work-description, "
                "[class*='about'] p, .book-detail-about p"
            )
            if desc_el:
                result.descripcion = desc_el.get_text(separator=" ", strip=True)
            if not result.descripcion:
                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc and meta_desc.get("content"):
                    result.descripcion = meta_desc["content"].strip()

            result.portada_url = f"{self.COVER_URL}/{isbn}"
            result.idioma = "en"

        except Exception as e:
            result.error = str(e)
        return result

    def _extract_utag(self, html: str) -> dict | None:
        m = re.search(r"utag_data\s*=\s*(\{.+?\})\s*;", html, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(m.group(1))
        except (json.JSONDecodeError, ValueError):
            return None

    def _extract_format(self, html: str, isbn: str) -> dict | None:
        pattern = r"(?:var\s+)?format\d+\s*=\s*(\{.+?\})\s*;\s*$"
        for m in re.finditer(pattern, html, re.MULTILINE):
            raw = m.group(1)
            if isbn in raw:
                try:
                    outer = json.loads(raw)
                    if isbn in outer:
                        return outer[isbn]
                    for val in outer.values():
                        if isinstance(val, dict):
                            return val
                except (json.JSONDecodeError, ValueError):
                    pass
        for m in re.finditer(pattern, html, re.MULTILINE):
            raw = m.group(1)
            try:
                outer = json.loads(raw)
                for val in outer.values():
                    if isinstance(val, dict):
                        return val
            except (json.JSONDecodeError, ValueError):
                pass
        return None

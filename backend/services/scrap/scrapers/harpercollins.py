from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


class HarperCollinsScraper(BookScraper):
    SOURCE_NAME = "harpercollins"
    BASE_URL = "https://harpercollins.co.uk"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            handle = self._search_handle(isbn)
            if not handle:
                return result
            product = self._fetch_product(handle)
            if not product:
                return result
            result = self._parse_product(product, isbn, result)
        except Exception as e:
            result.error = str(e)
        return result

    def _search_handle(self, isbn: str) -> str | None:
        url = f"{self.BASE_URL}/search/suggest.json"
        params = {
            "q": isbn,
            "resources[type]": "product",
            "resources[limit]": 5,
        }
        r = requests.get(
            url,
            params=params,
            timeout=self.TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        r.raise_for_status()
        data = r.json()
        products = (
            data.get("resources", {})
            .get("results", {})
            .get("products", [])
        )
        for p in products:
            tags = p.get("tags", [])
            if any(isbn in tag for tag in tags):
                return p.get("handle")
        return None

    def _fetch_product(self, handle: str) -> dict | None:
        url = f"{self.BASE_URL}/products/{handle}.json"
        r = requests.get(
            url,
            timeout=self.TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        r.raise_for_status()
        data = r.json()
        return data.get("product")

    def _parse_product(
        self, product: dict, isbn: str, result: BookResult
    ) -> BookResult:
        variants = product.get("variants", [])
        has_isbn = any(
            isbn_match(isbn, str(v.get("sku", ""))) or isbn_match(isbn, str(v.get("barcode", "")))
            for v in variants
        )
        tag_list_raw = product.get("tags", "")
        if isinstance(tag_list_raw, str):
            tag_list_check = [t.strip() for t in tag_list_raw.split(",")]
        else:
            tag_list_check = tag_list_raw
        if not has_isbn:
            has_isbn = any(isbn_match(isbn, t.split("-", 1)[1]) for t in tag_list_check
                          if t.startswith("isbn") and "-" in t)
        if not has_isbn:
            return result

        result.found = True
        result.titulo = product.get("title")
        result.editorial = "HarperCollins"

        tag_list = tag_list_check

        for tag in tag_list:
            if tag.startswith("imprint-"):
                result.editorial = tag.replace("imprint-", "").strip()
                break

        categories = []
        for tag in tag_list:
            if tag.startswith("l2-"):
                categories.append(tag.replace("l2-", "").strip())
        if categories:
            result.categoria = categories[0]

        body_html = product.get("body_html", "")
        if body_html:
            clean = re.sub(r"<[^>]+>", " ", body_html)
            clean = re.sub(r"\s+", " ", clean).strip()
            if len(clean) > 20:
                result.descripcion = clean

        images = product.get("images", [])
        if images:
            alt_text = images[0].get("alt", "")
            if alt_text and " by " in alt_text:
                author = alt_text.split(" by ", 1)[1].strip()
                if author:
                    result.autor = author

        matched_variant = None
        for v in variants:
            sku = str(v.get("sku", ""))
            barcode = str(v.get("barcode", ""))
            if isbn_match(isbn, sku) or isbn_match(isbn, barcode):
                matched_variant = v
                break

        if matched_variant:
            variant_title = matched_variant.get("title", "")
            m = re.search(r"\b(19|20)\d{2}\b", variant_title)
            if m:
                result.anio = int(m.group())
            if not result.portada_url:
                feat_img = matched_variant.get("featured_image")
                if feat_img:
                    result.portada_url = feat_img.get("src")

        if not result.portada_url and images:
            result.portada_url = images[0].get("src")

        if not result.anio:
            created = product.get("created_at", "")
            if created:
                m = re.search(r"\b(19|20)\d{2}\b", created)
                if m:
                    result.anio = int(m.group())

        if not result.autor:
            handle = product.get("handle", "")
            if handle and result.titulo:
                title_slug = re.sub(r"[^a-z0-9]+", "-", result.titulo.lower()).strip("-")
                if handle.startswith(title_slug) and len(handle) > len(title_slug) + 1:
                    author_slug = handle[len(title_slug):].strip("-")
                    if author_slug:
                        result.autor = author_slug.replace("-", " ").title()

        for v in variants:
            title = (v.get("title") or "").lower()
            if any(
                k in title
                for k in ("paperback", "hardback", "hardcover", "ebook", "audio")
            ):
                sku = str(v.get("sku", ""))
                barcode = str(v.get("barcode", ""))
                if isbn_match(isbn, sku) or isbn_match(isbn, barcode):
                    result.encuadernacion = v.get("title")
                    break
        if not result.encuadernacion and matched_variant:
            vt = matched_variant.get("title", "")
            if vt and vt.lower() != "default title":
                result.encuadernacion = vt

        result.idioma = "en"

        return result

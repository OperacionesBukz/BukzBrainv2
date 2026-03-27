from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


class OpenLibraryScraper(BookScraper):
    SOURCE_NAME = "openlibrary"
    API_URL = "https://openlibrary.org"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            r = requests.get(
                f"{self.API_URL}/isbn/{isbn}.json",
                timeout=self.TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code == 404:
                return result
            r.raise_for_status()
            data = r.json()

            found_isbns = data.get("isbn_13", []) + data.get("isbn_10", [])
            if found_isbns and not any(isbn_match(isbn, fi) for fi in found_isbns):
                return result

            result.found = True
            result.titulo = data.get("full_title") or data.get("title")
            subtitle = data.get("subtitle")
            if subtitle and result.titulo and subtitle not in result.titulo:
                result.titulo = f"{result.titulo}: {subtitle}"

            publishers = data.get("publishers", [])
            if publishers:
                result.editorial = publishers[0]

            publish_date = data.get("publish_date", "")
            if publish_date:
                m = re.search(r"\b(19|20)\d{2}\b", str(publish_date))
                if m:
                    result.anio = int(m.group())

            pages = data.get("number_of_pages")
            if pages and isinstance(pages, int) and pages > 0:
                result.paginas = pages

            physical_format = data.get("physical_format")
            if physical_format:
                result.encuadernacion = physical_format

            languages = data.get("languages", [])
            if languages:
                lang_key = languages[0].get("key", "")
                lang_code = lang_key.rsplit("/", 1)[-1] if "/" in lang_key else lang_key
                result.idioma = lang_code if lang_code else None

            authors = data.get("authors", [])
            if authors:
                author_key = authors[0].get("key", "")
                if author_key:
                    result.autor = self._fetch_author(author_key)

            result.portada_url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"

            works = data.get("works", [])
            if works:
                work_key = works[0].get("key", "")
                if work_key:
                    self._enrich_from_work(work_key, result)

        except Exception as e:
            result.error = str(e)
        return result

    def _fetch_author(self, author_key: str) -> str | None:
        try:
            r = requests.get(
                f"{self.API_URL}{author_key}.json",
                timeout=self.TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code == 200:
                return r.json().get("name")
        except Exception:
            pass
        return None

    def _enrich_from_work(self, work_key: str, result: BookResult) -> None:
        try:
            r = requests.get(
                f"{self.API_URL}{work_key}.json",
                timeout=self.TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code != 200:
                return
            data = r.json()

            if not result.descripcion:
                desc = data.get("description")
                if isinstance(desc, dict):
                    desc = desc.get("value", "")
                if desc and len(str(desc)) > 20:
                    result.descripcion = str(desc)

            if not result.categoria:
                subjects = data.get("subjects", [])
                if subjects:
                    result.categoria = subjects[0]

        except Exception:
            pass

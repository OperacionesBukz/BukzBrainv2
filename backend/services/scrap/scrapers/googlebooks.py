from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


class GoogleBooksScraper(BookScraper):
    SOURCE_NAME = "googlebooks"
    API_URL = "https://www.googleapis.com/books/v1/volumes"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            params = {"q": f"isbn:{isbn}", "maxResults": 1}
            r = requests.get(
                self.API_URL,
                params=params,
                timeout=self.TIMEOUT,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            r.raise_for_status()
            data = r.json()
            if data.get("totalItems", 0) == 0 or not data.get("items"):
                return result

            vol = data["items"][0].get("volumeInfo", {})
            identifiers = vol.get("industryIdentifiers", [])
            found_isbns = [i.get("identifier", "") for i in identifiers]
            if found_isbns and not any(isbn_match(isbn, fi) for fi in found_isbns):
                return result
            result.found = True
            result.titulo = vol.get("title")
            subtitle = vol.get("subtitle")
            if subtitle and result.titulo and subtitle not in result.titulo:
                result.titulo = f"{result.titulo}: {subtitle}"

            authors = vol.get("authors", [])
            if authors:
                result.autor = ", ".join(authors)

            result.editorial = vol.get("publisher")
            result.descripcion = vol.get("description")

            published = vol.get("publishedDate", "")
            if published:
                m = re.search(r"\b(19|20)\d{2}\b", published)
                if m:
                    result.anio = int(m.group())

            categories = vol.get("categories", [])
            if categories:
                result.categoria = categories[0]

            images = vol.get("imageLinks", {})
            result.portada_url = (
                images.get("thumbnail")
                or images.get("smallThumbnail")
                or images.get("large")
            )

            page_count = vol.get("pageCount")
            if page_count and isinstance(page_count, int) and page_count > 0:
                result.paginas = page_count

            result.idioma = vol.get("language")

            print_type = vol.get("printType")
            if print_type and print_type != "BOOK":
                result.encuadernacion = print_type

        except Exception as e:
            result.error = str(e)
        return result

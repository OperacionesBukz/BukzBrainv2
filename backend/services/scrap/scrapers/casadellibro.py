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

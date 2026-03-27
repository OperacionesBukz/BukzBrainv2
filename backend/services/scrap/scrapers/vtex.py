from __future__ import annotations
import re
import requests
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


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
            props = {
                prop["name"].lower(): prop["values"][0]
                for prop in p.get("properties", [])
                if prop.get("values")
            }
            found_isbn = (props.get("isbn") or props.get("ean")
                          or props.get("isbn13") or "")
            if not found_isbn:
                items_check = p.get("items", [])
                if items_check:
                    found_isbn = str(items_check[0].get("ean", ""))
            if found_isbn and not isbn_match(isbn, str(found_isbn)):
                return result
            result.found = True
            result.titulo = p.get("productName")
            result.descripcion = p.get("description") or p.get("metaTagDescription")
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

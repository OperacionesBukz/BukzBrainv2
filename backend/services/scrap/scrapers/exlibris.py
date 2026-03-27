from __future__ import annotations
import re
import requests
from bs4 import BeautifulSoup
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


class ExlibrisScraper(BookScraper):
    SOURCE_NAME = "exlibris"
    BASE_URL = "https://www.exlibris.com.co"

    def fetch(self, isbn: str) -> BookResult:
        result = BookResult(source=self.SOURCE_NAME, isbn=isbn)
        try:
            # 1. Search by ISBN
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

            # Title from dd.title a
            title_el = item.select_one("dd.title a")
            if title_el:
                result.titulo = title_el.get_text(strip=True) or None

            # Author from dd.creator
            creator_el = item.select_one("dd.creator")
            if creator_el:
                result.autor = creator_el.get_text(strip=True) or None

            # Synopsis from dd.mulsinop (available on search page)
            sinop_el = item.select_one("dd.mulsinop")
            if sinop_el:
                result.descripcion = sinop_el.get_text(strip=True) or None

            # Cover image + ISBN validation from image URL
            img = item.select_one("img.foto")
            if img and img.get("src"):
                result.portada_url = img["src"]
                match = re.search(r"/imagenes/\d+/(\d{12,13})", img["src"])
                if match and not isbn_match(isbn, match.group(1)):
                    return result

            # Detail page URL
            detail_path = title_el.get("href") if title_el else None

            result.found = True

            # 2. Fetch detail page for richer fields
            if detail_path:
                detail_url = self.BASE_URL + detail_path
                rd = requests.get(detail_url, timeout=self.TIMEOUT,
                                  headers={"User-Agent": "Mozilla/5.0"})
                rd.raise_for_status()
                ds = BeautifulSoup(rd.text, "html.parser")
                result = self._parse_detail(ds, result)

        except Exception as e:
            result.error = str(e)
        return result

    def _parse_detail(self, soup: BeautifulSoup, result: BookResult) -> BookResult:
        """Extract metadata from an Ex Libris detail page (DT/DD + #tabsinopsis)."""

        def get_dd(label: str) -> str | None:
            dt = soup.find("dt", string=re.compile(label, re.IGNORECASE))
            if dt:
                dd = dt.find_next_sibling("dd")
                return dd.get_text(strip=True) if dd else None
            return None

        found_isbn = get_dd("isbn") or get_dd("ean")
        if found_isbn and not isbn_match(result.isbn, found_isbn):
            result.found = False
            return result

        result.editorial = get_dd("editorial") or result.editorial
        result.categoria = get_dd("materia") or get_dd("tema") or result.categoria
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

        # Full synopsis from detail page (prefer over truncated search page version)
        tab_sinopsis = soup.find(id="tabsinopsis")
        if tab_sinopsis:
            first_p = tab_sinopsis.find("p")
            if first_p:
                full_desc = first_p.get_text(separator=" ", strip=True)
            else:
                full_desc = tab_sinopsis.get_text(separator=" ", strip=True)
            if full_desc and len(full_desc) > len(result.descripcion or ""):
                result.descripcion = full_desc

        return result

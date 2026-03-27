from __future__ import annotations
import re
import requests
from bs4 import BeautifulSoup
from services.scrap.base import BookResult, BookScraper
from services.scrap.isbn import isbn_match


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
            a = item.select_one("a.productClick")
            if a:
                result.titulo = a.get("data-name", "").strip() or None
            img = item.select_one("img")
            isbn_confirmed = False
            if img and img.get("src"):
                result.portada_url = img["src"]
                match = re.search(r"/imagenes/\d+/(\d{12,13})", img["src"])
                if match:
                    img_isbn = match.group(1)
                    if not isbn_match(isbn, img_isbn):
                        return result
                    isbn_confirmed = True
            product_path = a.get("href") if a else None
            if product_path:
                detail_url = self.BASE_URL + product_path
                rd = requests.get(detail_url, timeout=self.TIMEOUT,
                                  headers={"User-Agent": "Mozilla/5.0"})
                rd.raise_for_status()
                ds = BeautifulSoup(rd.text, "html.parser")
                result = self._parse_detail(ds, result)
            result.found = isbn_confirmed or result.found
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

        found_isbn = get_dd("isbn") or get_dd("ean")
        if found_isbn and not isbn_match(result.isbn, found_isbn):
            result.found = False
            return result

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

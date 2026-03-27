from __future__ import annotations
import datetime
import re
import statistics
import unicodedata
from typing import Optional
from services.scrap.base import BookResult, MergedBook

SOURCE_PRIORITY = ["casadellibro", "googlebooks", "penguinrandomhouse", "openlibrary", "panamericana", "lerner", "tornamesa", "exlibris", "harpercollins"]

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


def _normalize_text(text: str) -> str:
    """Normaliza texto para comparación: minúsculas, sin acentos, sin puntuación."""
    text = text.lower().strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_keywords(text: str) -> set[str]:
    """Extrae palabras clave ignorando artículos y conectores."""
    stop = {"the", "el", "la", "los", "las", "de", "del", "y", "and", "or", "a", "an",
            "editorial", "ediciones", "grupo", "publishing", "group", "books", "press",
            "inc", "llc", "ltd", "s a", "sa", "co"}
    words = _normalize_text(text).split()
    return {w for w in words if w not in stop and len(w) > 1}


def _authors_match(a: str, b: str) -> bool:
    """Compara autores considerando orden invertido y variantes."""
    if _normalize_text(a) == _normalize_text(b):
        return True
    kw_a = _extract_keywords(a)
    kw_b = _extract_keywords(b)
    if not kw_a or not kw_b:
        return True
    overlap = len(kw_a & kw_b)
    min_len = min(len(kw_a), len(kw_b))
    return overlap >= min_len * 0.5


def _publishers_match(a: str, b: str) -> bool:
    """Compara editoriales ignorando 'Editorial', 'Group', etc."""
    kw_a = _extract_keywords(a)
    kw_b = _extract_keywords(b)
    if not kw_a or not kw_b:
        return True
    return len(kw_a & kw_b) > 0


def _cross_validate(results: list[BookResult]) -> list[str]:
    """Validación cruzada entre fuentes. Devuelve lista de alertas."""
    found = [r for r in results if r.found]
    if len(found) < 2:
        return []

    alertas = []

    # Validar autores
    autores = [(r.source, r.autor) for r in found if r.autor]
    if len(autores) >= 2:
        base_source, base_autor = autores[0]
        for source, autor in autores[1:]:
            if not _authors_match(base_autor, autor):
                alertas.append(
                    f"Autor difiere: {base_source}=\"{base_autor}\" vs {source}=\"{autor}\""
                )
                break

    # Validar editoriales
    editoriales = [(r.source, r.editorial) for r in found if r.editorial]
    if len(editoriales) >= 2:
        base_source, base_ed = editoriales[0]
        for source, ed in editoriales[1:]:
            if not _publishers_match(base_ed, ed):
                alertas.append(
                    f"Editorial difiere: {base_source}=\"{base_ed}\" vs {source}=\"{ed}\""
                )
                break

    # Validar páginas (tolerancia ±20%)
    paginas = [(r.source, r.paginas) for r in found
               if r.paginas and isinstance(r.paginas, int) and r.paginas > 0]
    if len(paginas) >= 2:
        values = [p for _, p in paginas]
        min_p, max_p = min(values), max(values)
        if min_p > 0 and (max_p - min_p) / min_p > 0.2:
            pairs = ", ".join(f"{s}={p}" for s, p in paginas)
            alertas.append(f"Paginas difieren >20%: {pairs}")

    # Validar año
    anios = [(r.source, r.anio) for r in found
             if r.anio and isinstance(r.anio, int)]
    if len(anios) >= 2:
        values = [a for _, a in anios]
        if max(values) - min(values) > 2:
            pairs = ", ".join(f"{s}={a}" for s, a in anios)
            alertas.append(f"Anio difiere >2: {pairs}")

    return alertas


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

    alertas_list = _cross_validate(sorted_results)
    alertas_str = " | ".join(alertas_list) if alertas_list else ""

    return MergedBook(
        isbn=isbn,
        titulo=titulo, autor=autor, editorial=editorial, anio=anio,
        descripcion=descripcion, categoria=categoria, portada_url=portada_url,
        paginas=paginas, idioma=idioma, encuadernacion=encuadernacion,
        fuente_primaria=fuente,
        campos_encontrados=campos,
        found=found,
        alertas=alertas_str,
    )

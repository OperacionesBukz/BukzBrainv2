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

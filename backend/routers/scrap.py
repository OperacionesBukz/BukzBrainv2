"""
Router para el módulo Scrap Bukz — enriquecimiento de metadatos de libros.
"""
from __future__ import annotations
import io
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse

from services.scrap.isbn import validate_isbn, normalize_isbn
from services.scrap.runner import run as run_scraper
from services.scrap.base import MergedBook
from services.scrap import cache_store
from services.scrap.formatter_creacion import format_creacion

router = APIRouter(prefix="/api/scrap", tags=["Scrap Bukz"])

# ── Job management ─────────────────────────────────────────────────────────

@dataclass
class ScrapJob:
    job_id: str
    status: str = "processing"
    total: int = 0
    processed: int = 0
    logs: list[str] = field(default_factory=list)
    error: Optional[str] = None
    result_path: Optional[str] = None
    result_bytes: Optional[bytes] = None
    books: Optional[list[MergedBook]] = None
    created_at: datetime = field(default_factory=datetime.now)


_jobs: dict[str, ScrapJob] = {}
_jobs_lock = threading.Lock()

JOB_TTL = timedelta(hours=1)
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "tmp_scrap")


def _cleanup_old_jobs():
    now = datetime.now()
    with _jobs_lock:
        expired = [jid for jid, job in _jobs.items()
                   if now - job.created_at > JOB_TTL]
        for jid in expired:
            job = _jobs.pop(jid)
            if job.result_path and os.path.exists(job.result_path):
                os.remove(job.result_path)


def _get_job(job_id: str) -> ScrapJob:
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job


# ── ISBN detection from DataFrame ──────────────────────────────────────────

ISBN_COLUMN_NAMES = {"isbn", "ean", "isbn13", "isbn_13"}


def _detect_isbn_column(df: pd.DataFrame) -> Optional[str]:
    for col in df.columns:
        if col.strip().lower() in ISBN_COLUMN_NAMES:
            return col
    for col in df.columns:
        sample = df[col].dropna().head(10).astype(str)
        if sample.str.match(r"^\d{13}$").mean() > 0.5:
            return col
    return None


# ── Background task ────────────────────────────────────────────────────────

META_COLS = [
    "titulo", "autor", "editorial", "anio", "descripcion",
    "categoria", "portada_url", "paginas", "idioma",
    "encuadernacion", "fuente_primaria", "campos_encontrados",
    "alertas",
]


def _run_enrichment(
    job: ScrapJob,
    df_original: pd.DataFrame,
    isbn_col: str,
    valid_isbns: list[str],
    delay: float,
):
    try:
        def on_progress(isbn: str, book: MergedBook):
            with _jobs_lock:
                job.processed += 1
                if book.found:
                    icon = "ok" if book.campos_encontrados >= 5 else "parcial"
                    job.logs.append(
                        f"{icon}|{isbn}|{book.fuente_primaria}|{book.campos_encontrados}/10"
                    )
                else:
                    job.logs.append(f"no|{isbn}||0/10")

        books = run_scraper(valid_isbns, delay=delay, progress_cb=on_progress)

        books_dict = {b.isbn: b for b in books}
        rows = []
        for _, row in df_original.iterrows():
            isbn_raw = str(row[isbn_col]).strip()
            norm = normalize_isbn(isbn_raw) if validate_isbn(isbn_raw) else None
            book = books_dict.get(norm) if norm else None
            meta = {col: getattr(book, col, None) if book else None for col in META_COLS}
            rows.append({**row.to_dict(), **meta})

        df_result = pd.DataFrame(rows)

        # Generate Excel in memory
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            df_result.to_excel(writer, index=False)
        excel_bytes = buffer.getvalue()

        # Also save to disk as fallback
        result_path = None
        try:
            os.makedirs(TEMP_DIR, exist_ok=True)
            result_path = os.path.join(TEMP_DIR, f"{job.job_id}.xlsx")
            with open(result_path, "wb") as f:
                f.write(excel_bytes)
        except OSError:
            pass

        # Keep ordered list of MergedBook for format_creacion (all, including not found)
        all_books: list[MergedBook] = []
        for _, row in df_original.iterrows():
            isbn_raw = str(row[isbn_col]).strip()
            norm = normalize_isbn(isbn_raw) if validate_isbn(isbn_raw) else None
            book = books_dict.get(norm) if norm else None
            if book:
                all_books.append(book)
            elif norm:
                all_books.append(MergedBook(isbn=norm, found=False))

        with _jobs_lock:
            job.result_bytes = excel_bytes
            job.result_path = result_path
            job.books = all_books
            job.status = "completed"

    except Exception as e:
        with _jobs_lock:
            job.status = "error"
            job.error = str(e)


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/enrich")
async def enrich(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    delay: float = Query(0.3, ge=0.0, le=2.0),
):
    _cleanup_old_jobs()

    content = await file.read()
    filename = file.filename or ""
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo archivo: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    isbn_col = _detect_isbn_column(df)
    if isbn_col is None:
        raise HTTPException(
            status_code=400,
            detail=f"No se detectó columna ISBN. Columnas disponibles: {list(df.columns)}",
        )

    df["_isbn_raw"] = df[isbn_col].astype(str).str.strip()
    df["_isbn_norm"] = df["_isbn_raw"].apply(
        lambda x: normalize_isbn(x) if validate_isbn(x) else None
    )
    valid_mask = df["_isbn_norm"].notna()
    valid_isbns = df.loc[valid_mask, "_isbn_norm"].tolist()
    invalid_isbns = df.loc[~valid_mask, isbn_col].tolist()

    df_clean = df.drop(columns=["_isbn_raw", "_isbn_norm"])

    if not valid_isbns:
        raise HTTPException(status_code=400, detail="No se encontraron ISBNs válidos")

    job_id = str(uuid.uuid4())
    job = ScrapJob(job_id=job_id, total=len(valid_isbns))
    with _jobs_lock:
        _jobs[job_id] = job

    background_tasks.add_task(
        _run_enrichment, job, df_clean, isbn_col, valid_isbns, delay
    )

    return {
        "job_id": job_id,
        "total_isbns": len(valid_isbns),
        "invalid_isbns": invalid_isbns,
        "valid_count": len(valid_isbns),
        "isbn_column": isbn_col,
    }


@router.get("/status/{job_id}")
def job_status(job_id: str):
    job = _get_job(job_id)
    return {
        "status": job.status,
        "processed": job.processed,
        "total": job.total,
        "logs": job.logs,
        "error": job.error,
    }


@router.get("/download/{job_id}")
def download_result(job_id: str, format: str = Query("raw")):
    job = _get_job(job_id)
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="El job aún no ha terminado")

    # Formato Creacion_productos
    if format == "creacion":
        if not job.books:
            raise HTTPException(status_code=400, detail="No hay datos de libros disponibles")
        excel_bytes = format_creacion(job.books)
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Creacion_productos.xlsx"},
        )

    # Formato raw (default)
    if job.result_bytes:
        return StreamingResponse(
            io.BytesIO(job.result_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=libros_enriquecidos.xlsx"},
        )

    if job.result_path and os.path.exists(job.result_path):
        def iterfile():
            with open(job.result_path, "rb") as f:
                yield from f
        return StreamingResponse(
            iterfile(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=libros_enriquecidos.xlsx"},
        )

    raise HTTPException(status_code=404, detail="Archivo de resultado no encontrado")


@router.get("/cache/stats")
def get_cache_stats():
    return cache_store.stats()


@router.delete("/cache/clear")
def clear_cache():
    cache_store.clear()
    return {"success": True}

"""
Router de búsqueda global.
Permite buscar productos en el catálogo PostgreSQL.
"""
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/products")
def search_products(
    q: str = Query(..., min_length=1, description="Término de búsqueda"),
    limit: int = Query(5, ge=1, le=20, description="Máximo de resultados"),
):
    """
    Busca productos en el catálogo por título, SKU (ISBN) o vendor.
    Búsqueda case-insensitive con coincidencia parcial.
    """
    from services.database import pg_read_product_catalog

    catalog = pg_read_product_catalog()
    if not catalog:
        return {"results": [], "total": 0}

    term = q.strip().lower()
    matches = []

    for product in catalog:
        title = (product.get("title") or "").lower()
        sku = (product.get("sku") or "").lower()
        vendor = (product.get("vendor") or "").lower()

        # Scoring: exact SKU match > title starts with > title contains > vendor contains
        score = 0
        if sku == term:
            score = 100
        elif term in sku:
            score = 80
        elif title.startswith(term):
            score = 60
        elif term in title:
            score = 40
        elif term in vendor:
            score = 20

        if score > 0:
            matches.append((score, product))

    # Sort by score descending, then alphabetically
    matches.sort(key=lambda x: (-x[0], (x[1].get("title") or "")))
    total = len(matches)
    top = matches[:limit]

    results = []
    for _, p in top:
        results.append({
            "sku": p.get("sku", ""),
            "title": p.get("title", ""),
            "vendor": p.get("vendor", ""),
            "price": p.get("price"),
            "category": p.get("product_type") or p.get("category", ""),
        })

    return {"results": results, "total": total}

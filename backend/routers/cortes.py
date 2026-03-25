"""
Router de Cortes — endpoint para procesar archivos de corte con deteccion de regalos 3X2.
"""
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from services import orders_service

router = APIRouter(prefix="/api/cortes", tags=["Cortes"])


@router.post("/process")
async def process_cortes(file: UploadFile = File(...)):
    """
    Recibe un Excel de corte, identifica regalos 3X2 via Shopify,
    y retorna el Excel con la columna 'Detalle' agregada.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos .xlsx o .xls")

    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo el archivo: {e}")

    # Validar columnas requeridas
    required = ["Order name", "Discount name", "Product variant SKU"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas faltantes: {', '.join(missing)}",
        )

    # Inicializar columna Detalle
    df["Detalle"] = ""

    # Filtrar filas con 3X2
    mask_3x2 = df["Discount name"].fillna("").str.upper().str.contains("3X2")
    rows_3x2 = df[mask_3x2]

    if rows_3x2.empty:
        # No hay filas 3X2, retornar tal cual con columna vacia
        output = BytesIO()
        df.to_excel(output, index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=corte_procesado.xlsx"},
        )

    # Extraer order names unicos de filas 3X2
    unique_orders = rows_3x2["Order name"].dropna().unique().tolist()
    unique_orders = [str(o).strip() for o in unique_orders if str(o).strip()]

    # Consultar Shopify
    try:
        orders_data = orders_service.get_orders_details(unique_orders)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando Shopify: {e}")

    # Identificar regalo por orden
    gift_by_order: dict[str, str | None] = {}
    for order_name in unique_orders:
        line_items = orders_data.get(order_name, [])
        gift_by_order[order_name] = orders_service.identify_gift_sku(line_items)

    # Asignar Detalle (solo 1 regalo por orden)
    gift_assigned: set[str] = set()

    for idx in df.index:
        discount = str(df.at[idx, "Discount name"] or "").upper()
        if "3X2" not in discount:
            continue

        order_name = str(df.at[idx, "Order name"] or "").strip()
        sku = str(df.at[idx, "Product variant SKU"] or "").strip()
        gift_sku = gift_by_order.get(order_name)

        if gift_sku and sku == gift_sku and order_name not in gift_assigned:
            df.at[idx, "Detalle"] = "Regalo"
            gift_assigned.add(order_name)
        else:
            df.at[idx, "Detalle"] = "NO APLICA"

    # Generar Excel de salida
    output = BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=corte_procesado.xlsx"},
    )

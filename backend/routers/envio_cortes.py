"""
Router para envío masivo de cortes de ventas / no ventas a proveedores por email.
Migrado desde el panel Streamlit (Modulos/CortesVentas.py y CortesNoVentas.py).
"""
import base64
import zipfile
from io import BytesIO
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.email_service import build_no_ventas_html, build_ventas_html, send_email
router = APIRouter(prefix="/api/envio-cortes", tags=["envio-cortes"])

# ---------------------------------------------------------------------------
# Constantes (migradas desde Panel-Operaciones/Modulos/config.py)
# ---------------------------------------------------------------------------

PROVEEDORES_EXCLUIR = [
    "603 La Gran Via",
    "Alejandra Márquez Villegas",
    "Andina",
    "Books for U",
    "Bukz",
    "Bukz España",
    "Bukz USA",
    "Bukz.co",
    "Fernando Ayerbe",
    "Grupo Editorial Planeta",
    "Juan D. Hoyos Distribuciones SAS",
    "Libros de Ruta",
    "Luminosa",
    "Melon",
    "Penguin RandomHouse",
    "Pergamino Café",
    "Postobon",
    "Tea market",
    "Torrealta",
    "Urban",
    "Álvaro González Alorda",
]

LOCATION_MAP: dict[str, str] = {
    "Bukz Las Lomas": "Medellin",
    "Bukz Museo de Antioquia": "Medellin",
    "Bukz Viva Envigado": "Medellin",
    "Feria B2B MDE": "Medellin",
    "Bukz Mattelsa": "Medellin",
    "": "Medellin",
    "Bukz St. Patrick": "Bogota",
    "Bukz Bogota 109": "Bogota",
    "Feria Medellin": "Medellin",
    "Feria Bogota": "Bogota",
}

DEFAULT_LOCATION = "Medellin"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _custom_sum(group: pd.Series) -> float:
    """Si todos los valores son <= 0 suma todo; si no, suma solo los positivos."""
    if (group <= 0).all():
        return group.sum()
    return group[group >= 0].sum()


def _format_sku(value) -> str:
    """Convierte SKU a número sin decimales."""
    try:
        return f"{float(value):.0f}"
    except (ValueError, TypeError):
        return str(value)


def _build_proveedor_excel(df_proveedor: pd.DataFrame) -> bytes:
    """Genera un Excel en memoria con hojas por ciudad (Medellin/Bogota)."""
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        sheets_written = False
        for ciudad in ["Medellin", "Bogota"]:
            df_ciudad = df_proveedor[df_proveedor["pos_location_name"] == ciudad]
            if not df_ciudad.empty:
                df_ciudad.to_excel(writer, sheet_name=ciudad, index=False)
                sheets_written = True
        if not sheets_written:
            pd.DataFrame().to_excel(writer, sheet_name="Vacio", index=False)
    return buf.getvalue()


def _parse_correos(correo_str: str) -> tuple[list[str], list[str] | None]:
    """Separa string de correos por ';' en destinatario principal + CC."""
    correos = [c.strip() for c in str(correo_str).split(";") if c.strip()]
    if not correos:
        return [], None
    return [correos[0]], correos[1:] if len(correos) > 1 else None


# ---------------------------------------------------------------------------
# POST /api/envio-cortes/ventas
# ---------------------------------------------------------------------------

@router.post("/ventas")
async def enviar_cortes_ventas(
    ventas_file: UploadFile = File(...),
    mes: str = Form(...),
    anio: str = Form(...),
    remitente: str = Form(...),
    proveedores_file: UploadFile = File(...),
):
    """Procesa ventas mensuales, genera Excel por proveedor y envía emails."""

    # --- Leer archivo de proveedores ---
    correo_map: dict[str, str] = {}
    try:
        prov_df = pd.read_excel(BytesIO(await proveedores_file.read()))
        prov_df.columns = prov_df.columns.str.strip()
    except Exception:
        raise HTTPException(400, detail="No se pudo leer el archivo de proveedores")

    prov_required = {"Proveedores", "Correo"}
    if not prov_required.issubset(set(prov_df.columns)):
        raise HTTPException(
            400,
            detail=f"El archivo de proveedores debe tener las columnas: {', '.join(prov_required)}",
        )
    correo_map = dict(
        zip(prov_df["Proveedores"], prov_df["Correo"].astype(str))
    )

    # --- Leer archivo de ventas ---
    try:
        ventas_df = pd.read_excel(BytesIO(await ventas_file.read()))
        ventas_df.columns = ventas_df.columns.str.strip()
    except Exception:
        raise HTTPException(400, detail="No se pudo leer el archivo de ventas")

    # --- Validar columnas ---
    ventas_required = {
        "product_title", "variant_sku", "product_vendor",
        "pos_location_name", "net_quantity",
    }
    if not ventas_required.issubset(set(ventas_df.columns)):
        raise HTTPException(
            400,
            detail=f"El archivo de ventas debe tener las columnas: {', '.join(ventas_required)}",
        )

    # --- Normalizar ubicaciones ---
    ventas_df["pos_location_name"] = (
        ventas_df["pos_location_name"]
        .fillna("")
        .replace(LOCATION_MAP)
    )
    # Cualquier ubicación no mapeada → default
    known = set(LOCATION_MAP.values())
    ventas_df.loc[
        ~ventas_df["pos_location_name"].isin(known), "pos_location_name"
    ] = DEFAULT_LOCATION

    # --- Filtrar proveedores excluidos ---
    ventas_df = ventas_df[~ventas_df["product_vendor"].isin(PROVEEDORES_EXCLUIR)]

    # --- Agrupar ---
    grouped = (
        ventas_df
        .groupby(["product_title", "product_vendor", "variant_sku", "pos_location_name"])["net_quantity"]
        .apply(_custom_sum)
        .reset_index()
    )
    grouped["variant_sku"] = grouped["variant_sku"].apply(_format_sku)

    # --- Enviar emails + generar archivos ---
    html_body = build_ventas_html(mes)
    resultados: list[dict] = []
    zip_buf = BytesIO()

    vendor_groups = {vendor: sub_df for vendor, sub_df in grouped.groupby("product_vendor")}

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for proveedor, sub_df in vendor_groups.items():
            correo_raw = correo_map.get(proveedor, "")
            to_list, cc_list = _parse_correos(correo_raw)

            if not to_list:
                resultados.append({
                    "proveedor": proveedor,
                    "correo": "",
                    "estado": "sin_correo",
                    "detalle": "Correo no encontrado en archivo de proveedores",
                })
                continue

            excel_bytes = _build_proveedor_excel(sub_df)
            attachment_name = f"Corte_Ventas_{mes}.xlsx"

            try:
                send_email(
                    to=to_list,
                    subject=f"Corte {mes} {anio} - {proveedor}",
                    html_body=html_body,
                    sender_name=remitente,
                    cc=cc_list,
                    attachments=[(attachment_name, excel_bytes)],
                )
                resultados.append({
                    "proveedor": proveedor,
                    "correo": "; ".join(to_list + (cc_list or [])),
                    "estado": "enviado",
                    "detalle": "Correo enviado correctamente",
                })
            except Exception as e:
                resultados.append({
                    "proveedor": proveedor,
                    "correo": "; ".join(to_list + (cc_list or [])),
                    "estado": "error",
                    "detalle": str(e),
                })

            # Agregar al ZIP independientemente del resultado del email
            zf.writestr(f"{proveedor}.xlsx", excel_bytes)

        # Agregar estado de envío al ZIP
        estado_df = pd.DataFrame(resultados)
        estado_buf = BytesIO()
        estado_df.to_excel(estado_buf, index=False, engine="openpyxl")
        zf.writestr("estado_envio.xlsx", estado_buf.getvalue())

    # --- Resumen ---
    enviados = sum(1 for r in resultados if r["estado"] == "enviado")
    errores = sum(1 for r in resultados if r["estado"] == "error")
    sin_correo = sum(1 for r in resultados if r["estado"] == "sin_correo")

    return {
        "resultados": resultados,
        "resumen": {
            "enviados": enviados,
            "errores": errores,
            "sin_correo": sin_correo,
        },
        "zip_base64": base64.b64encode(zip_buf.getvalue()).decode("ascii"),
    }


# ---------------------------------------------------------------------------
# POST /api/envio-cortes/no-ventas
# ---------------------------------------------------------------------------

@router.post("/no-ventas")
async def enviar_cortes_no_ventas(
    estado_file: UploadFile = File(...),
    mes: str = Form(...),
    anio: str = Form(...),
    remitente: str = Form(...),
    proveedores_file: UploadFile = File(...),
):
    """Identifica proveedores sin ventas y les envía notificación por email."""

    # --- Leer archivo de proveedores ---
    correo_map: dict[str, str] = {}
    try:
        prov_df = pd.read_excel(BytesIO(await proveedores_file.read()))
        prov_df.columns = prov_df.columns.str.strip()
    except Exception:
        raise HTTPException(400, detail="No se pudo leer el archivo de proveedores")

    if "Proveedores" not in prov_df.columns or "Correo" not in prov_df.columns:
        raise HTTPException(
            400, detail="El archivo de proveedores debe tener las columnas: Proveedores, Correo"
        )
    correo_map = dict(
        zip(prov_df["Proveedores"], prov_df["Correo"].astype(str))
    )

    try:
        estado_df = pd.read_excel(BytesIO(await estado_file.read()))
        estado_df.columns = estado_df.columns.str.strip()
    except Exception:
        raise HTTPException(400, detail="No se pudo leer el archivo de estado de envío")

    # Detectar columna de proveedor en estado (puede ser "Proveedor" o "proveedor")
    estado_col = None
    for col in estado_df.columns:
        if col.lower() == "proveedor":
            estado_col = col
            break
    if estado_col is None:
        raise HTTPException(
            400, detail="El archivo de estado debe tener la columna: Proveedor"
        )

    # --- Identificar proveedores sin ventas ---
    proveedores_con_ventas = set(estado_df[estado_col].dropna().astype(str))
    # Build list of all known suppliers (from file or Firestore)
    all_suppliers = list(correo_map.keys())
    no_ventas_proveedores = [p for p in all_suppliers if p not in proveedores_con_ventas]

    # Filtrar proveedores excluidos
    no_ventas_proveedores = [p for p in no_ventas_proveedores if p not in PROVEEDORES_EXCLUIR]

    # --- Enviar emails ---
    html_body = build_no_ventas_html(mes)
    resultados: list[dict] = []

    for proveedor in no_ventas_proveedores:
        correo_raw = correo_map.get(proveedor, "")
        to_list, cc_list = _parse_correos(correo_raw)

        if not to_list:
            resultados.append({
                "proveedor": proveedor,
                "correo": "",
                "estado": "sin_correo",
                "detalle": "Correo no encontrado",
            })
            continue

        try:
            send_email(
                to=to_list,
                subject=f"Corte {mes} {anio} - {proveedor}",
                html_body=html_body,
                sender_name=remitente,
                cc=cc_list,
            )
            resultados.append({
                "proveedor": proveedor,
                "correo": "; ".join(to_list + (cc_list or [])),
                "estado": "enviado",
                "detalle": "Notificación enviada correctamente",
            })
        except Exception as e:
            resultados.append({
                "proveedor": proveedor,
                "correo": "; ".join(to_list + (cc_list or [])),
                "estado": "error",
                "detalle": str(e),
            })

    # --- Resumen ---
    enviados = sum(1 for r in resultados if r["estado"] == "enviado")
    errores = sum(1 for r in resultados if r["estado"] == "error")
    sin_correo = sum(1 for r in resultados if r["estado"] == "sin_correo")

    return {
        "resultados": resultados,
        "resumen": {
            "enviados": enviados,
            "errores": errores,
            "sin_correo": sin_correo,
        },
    }


# ---------------------------------------------------------------------------
# POST /api/envio-cortes/individual
# ---------------------------------------------------------------------------

@router.post("/individual")
async def enviar_corte_individual(
    ventas_file: UploadFile = File(...),
    proveedor: str = Form(...),
    correo: str = Form(...),
    correo_cc: str = Form(""),
    mes: str = Form(...),
    anio: str = Form(...),
    remitente: str = Form(...),
):
    """Envía un corte de ventas individual a un proveedor específico."""

    # --- Leer archivo de ventas ---
    try:
        ventas_df = pd.read_excel(BytesIO(await ventas_file.read()))
        ventas_df.columns = ventas_df.columns.str.strip()
    except Exception:
        raise HTTPException(400, detail="No se pudo leer el archivo de ventas")

    # --- Validar columnas ---
    ventas_required = {
        "product_title", "variant_sku", "product_vendor",
        "pos_location_name", "net_quantity",
    }
    if not ventas_required.issubset(set(ventas_df.columns)):
        raise HTTPException(
            400,
            detail=f"El archivo de ventas debe tener las columnas: {', '.join(ventas_required)}",
        )

    # --- Filtrar por proveedor (case-insensitive) ---
    mask = (
        ventas_df["product_vendor"].astype(str).str.lower().str.strip()
        == proveedor.lower().strip()
    )
    df_filtered = ventas_df[mask]

    # Si no hay coincidencias, usar todas las filas (archivo ya es específico del proveedor)
    if df_filtered.empty:
        df_filtered = ventas_df

    # --- Normalizar ubicaciones ---
    df_filtered = df_filtered.copy()
    df_filtered["pos_location_name"] = (
        df_filtered["pos_location_name"]
        .fillna("")
        .replace(LOCATION_MAP)
    )
    known = set(LOCATION_MAP.values())
    df_filtered.loc[
        ~df_filtered["pos_location_name"].isin(known), "pos_location_name"
    ] = DEFAULT_LOCATION

    # --- Agrupar ---
    grouped = (
        df_filtered
        .groupby(["product_title", "product_vendor", "variant_sku", "pos_location_name"])["net_quantity"]
        .apply(_custom_sum)
        .reset_index()
    )
    grouped["variant_sku"] = grouped["variant_sku"].apply(_format_sku)

    # --- Generar Excel adjunto ---
    excel_bytes = _build_proveedor_excel(grouped)
    attachment_name = f"Corte_Ventas_{mes}.xlsx"

    # --- Parsear CC ---
    cc_list = [c.strip() for c in correo_cc.split(";") if c.strip()] if correo_cc else []

    # --- Enviar email ---
    html_body = build_ventas_html(mes)
    subject = f'Corte de venta "{proveedor}" {mes} {anio}'

    try:
        send_email(
            to=[correo],
            subject=subject,
            html_body=html_body,
            sender_name=remitente,
            cc=cc_list or None,
            attachments=[(attachment_name, excel_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar el correo: {e}")

    return {
        "success": True,
        "proveedor": proveedor,
        "correo": correo,
        "correo_cc": cc_list,
        "asunto": subject,
        "filas_procesadas": len(grouped),
    }
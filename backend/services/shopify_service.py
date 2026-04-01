"""
Servicio de Shopify — lógica de negocio extraída de IngresoMercancia.py
Sin dependencias de Streamlit. Puro Python + requests.
"""
import json
import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

import threading

from config import settings


def _sanitize_graphql_value(value: str) -> str:
    """Elimina caracteres que podrían romper/inyectar queries GraphQL."""
    return re.sub(r'["\\\n\r{}()\[\]]', "", value.strip())


# ---------------------------------------------------------------------------
# Rate limiter reactivo
# ---------------------------------------------------------------------------

class ShopifyThrottler:
    """Rate limiter reactivo para la API de Shopify."""

    def __init__(self, low_threshold: float = 0.2, critical_threshold: float = 0.1):
        self._lock = threading.Lock()
        self._available_ratio = 1.0
        self._low_threshold = low_threshold
        self._critical_threshold = critical_threshold

    def update_from_response(self, response: requests.Response):
        """Lee headers de rate limit y actualiza estado interno."""
        limit_header = response.headers.get("X-Shopify-Shop-Api-Call-Limit")
        if limit_header and "/" in limit_header:
            try:
                used, total = limit_header.split("/")
                with self._lock:
                    self._available_ratio = 1.0 - (int(used) / int(total))
            except (ValueError, ZeroDivisionError):
                pass
            return

        try:
            body = response.json()
            cost = body.get("extensions", {}).get("cost", {})
            available = cost.get("throttleStatus", {}).get("currentlyAvailable", 0)
            maximum = cost.get("throttleStatus", {}).get("maximumAvailable", 1000)
            if maximum > 0:
                with self._lock:
                    self._available_ratio = available / maximum
        except Exception:
            pass

    def wait_if_needed(self):
        """Bloquea si la cuota esta baja."""
        with self._lock:
            ratio = self._available_ratio

        if ratio < self._critical_threshold:
            time.sleep(1.0)
        elif ratio < self._low_threshold:
            time.sleep(0.5)

    def handle_429(self, response: requests.Response) -> float:
        """Retorna segundos a esperar ante un 429."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        return 2.0


_throttler = ShopifyThrottler()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def chunk_list(lst: list, chunk_size: int):
    """Divide una lista en chunks de tamaño específico."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]


# ---------------------------------------------------------------------------
# Conexión y bodegas
# ---------------------------------------------------------------------------

def verify_shopify_connection() -> dict:
    """Verifica conexión con Shopify. Retorna info de la tienda."""
    headers = settings.get_shopify_headers()
    rest_url = settings.get_rest_url()
    url = f"{rest_url}/shop.json"

    response = requests.get(url, headers=headers, timeout=10)
    if response.status_code == 200:
        shop_info = response.json().get("shop", {})
        return {
            "connected": True,
            "shop_name": shop_info.get("name", ""),
            "shop_url": shop_info.get("myshopify_domain", ""),
        }
    return {"connected": False, "error": f"HTTP {response.status_code}"}


def get_locations() -> dict:
    """Obtiene ubicaciones/bodegas de Shopify. Retorna dict {name: id} o lanza excepción."""
    errors = []

    # Intentar primero con GraphQL (más probable que tenga permisos)
    try:
        graphql_url = settings.get_graphql_url()
        headers = settings.get_shopify_headers()
        query = '{ locations(first: 50) { edges { node { id name } } } }'
        print(f"[LOCATIONS] Trying GraphQL: {graphql_url}", flush=True)
        response = requests.post(
            graphql_url, json={"query": query}, headers=headers, timeout=15
        )
        print(f"[LOCATIONS] GraphQL response: {response.status_code}", flush=True)
        if response.status_code == 200:
            body = response.json()
            data = body.get("data")
            if data:
                edges = data.get("locations", {}).get("edges", [])
                if edges:
                    result = {}
                    for edge in edges:
                        node = edge["node"]
                        result[node["name"]] = node["id"]
                    print(f"[LOCATIONS] GraphQL OK: {len(result)} locations", flush=True)
                    return result
            gql_errors = body.get("errors", [])
            errors.append(f"GraphQL: {gql_errors or 'empty data'}")
        else:
            errors.append(f"GraphQL HTTP {response.status_code}")
    except Exception as e:
        errors.append(f"GraphQL: {e}")
        print(f"[LOCATIONS] GraphQL error: {e}", flush=True)

    # Fallback: REST API
    try:
        headers = settings.get_shopify_headers()
        rest_url = settings.get_rest_url()
        url = f"{rest_url}/locations.json"
        print(f"[LOCATIONS] Trying REST: {url}", flush=True)
        response = requests.get(url, headers=headers, timeout=15)
        print(f"[LOCATIONS] REST response: {response.status_code}", flush=True)
        if response.status_code == 200:
            locations_data = response.json().get("locations", [])
            result = {loc["name"]: f"gid://shopify/Location/{loc['id']}" for loc in locations_data}
            print(f"[LOCATIONS] REST OK: {len(result)} locations", flush=True)
            return result
        errors.append(f"REST HTTP {response.status_code}: {response.text[:200]}")
    except Exception as e:
        errors.append(f"REST: {e}")
        print(f"[LOCATIONS] REST error: {e}", flush=True)

    error_msg = " | ".join(errors)
    print(f"[LOCATIONS] All methods failed: {error_msg}", flush=True)
    raise RuntimeError(f"No se pudieron obtener bodegas: {error_msg}")


# ---------------------------------------------------------------------------
# Consulta de productos (búsqueda individual y masiva)
# ---------------------------------------------------------------------------

def _build_batch_query(isbn_list: list[str]) -> str:
    """Construye query GraphQL para múltiples ISBNs."""
    safe = [_sanitize_graphql_value(isbn) for isbn in isbn_list]
    conditions = " OR ".join([f"sku:{isbn} OR barcode:{isbn}" for isbn in safe])
    return """
    {
      productVariants(first: 100, query: "%s") {
        edges {
          node {
            id
            sku
            barcode
            price
            inventoryItem { id }
            product {
              id
              title
              vendor
              metafields(first: 50) {
                edges {
                  node { namespace key value }
                }
              }
            }
          }
        }
      }
    }
    """ % conditions


def _build_update_query(isbn_list: list[str]) -> str:
    """Construye query GraphQL extendida para update preview (trae todos los campos)."""
    safe = [_sanitize_graphql_value(isbn) for isbn in isbn_list]
    conditions = " OR ".join([f"sku:{isbn} OR barcode:{isbn}" for isbn in safe])
    return """
    {
      productVariants(first: 100, query: "%s") {
        edges {
          node {
            id
            sku
            barcode
            price
            compareAtPrice
            inventoryItem {
              id
              measurement { weight { value unit } }
            }
            product {
              id
              title
              vendor
              descriptionHtml
              images(first: 1) { edges { node { url } } }
              metafields(first: 50) {
                edges {
                  node { namespace key value }
                }
              }
            }
          }
        }
      }
    }
    """ % conditions


def _extract_metafield(metafields_edges: list, key: str) -> str:
    """Extrae un metafield por key."""
    for meta_edge in metafields_edges:
        meta = meta_edge.get("node", {})
        if meta.get("namespace") == "custom" and meta.get("key") == key:
            valor = meta.get("value", "")
            # Limpiar formato lista JSON
            return (
                valor.replace('["', "").replace('"]', "")
                .replace("[", "").replace("]", "")
                .replace('"', "").strip()
            )
    return ""


def _process_batch_for_update(
    session: requests.Session,
    isbn_batch: list[str],
) -> dict:
    """Procesa un batch de ISBNs para update preview, trayendo todos los campos."""
    graphql_url = settings.get_graphql_url()
    results = {}

    try:
        query = _build_update_query(isbn_batch)
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)

        if response.status_code == 200:
            data = response.json()
            edges = (
                data.get("data", {})
                .get("productVariants", {})
                .get("edges", [])
            )

            for edge in edges:
                node = edge["node"]
                sku = str(node.get("sku", "")).strip()
                barcode = str(node.get("barcode", "")).strip()

                matched_isbn = None
                for isbn in isbn_batch:
                    if sku == isbn or barcode == isbn:
                        matched_isbn = isbn
                        break

                if matched_isbn and matched_isbn not in results:
                    product = node["product"]
                    metafields = product.get("metafields", {}).get("edges", [])
                    images = product.get("images", {}).get("edges", [])
                    weight_data = (
                        node.get("inventoryItem", {})
                        .get("measurement", {})
                        .get("weight", {})
                    )

                    results[matched_isbn] = {
                        "sku": sku,
                        "product_id": product.get("id", ""),
                        "variant_id": node.get("id", ""),
                        "title": product.get("title", ""),
                        "current": {
                            "Titulo": product.get("title", ""),
                            "Sipnosis": product.get("descriptionHtml", ""),
                            "Vendor": product.get("vendor", ""),
                            "Precio": str(node.get("price", "")),
                            "Precio de comparacion": str(node.get("compareAtPrice", "") or ""),
                            "Portada (URL)": images[0]["node"]["url"] if images else "",
                            "Autor": _extract_metafield(metafields, "autor"),
                            "Editorial": _extract_metafield(metafields, "editorial"),
                            "Idioma": _extract_metafield(metafields, "idioma"),
                            "Formato": _extract_metafield(metafields, "formato"),
                            "Categoria": _extract_metafield(metafields, "categoria"),
                            "Subcategoria": _extract_metafield(metafields, "subcategoria"),
                            "Peso (kg)": str(weight_data.get("value", "")) if weight_data else "",
                        },
                    }
    except Exception as e:
        print(f"[UPDATE PREVIEW] Error: {e}", flush=True)

    return results


def fetch_products_for_update(isbn_list: list[str]) -> dict:
    """
    Busca productos completos en Shopify para preview de actualizacion.
    Retorna dict {isbn: {sku, product_id, variant_id, title, current: {field: value}}}.
    """
    headers = settings.get_shopify_headers()
    batches = list(chunk_list(isbn_list, settings.BATCH_SIZE))
    all_results = {}
    session = requests.Session()
    session.headers.update(headers)

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(_process_batch_for_update, session, batch): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            all_results.update(future.result())

    return all_results


_METAFIELD_KEY_MAP = {
    "Autor": ("custom", "autor", "single_line_text_field"),
    "Editorial": ("custom", "editorial", "single_line_text_field"),
    "Idioma": ("custom", "idioma", "list.single_line_text_field"),
    "Formato": ("custom", "formato", "list.single_line_text_field"),
    "Categoria": ("custom", "categoria", "list.single_line_text_field"),
    "Subcategoria": ("custom", "subcategoria", "list.single_line_text_field"),
}

_PRODUCT_FIELDS = {"Titulo", "Sipnosis", "Vendor"}
_VARIANT_FIELDS = {"Precio", "Precio de comparacion", "Peso (kg)"}
_MEDIA_FIELDS = {"Portada (URL)"}
_METAFIELD_FIELDS = set(_METAFIELD_KEY_MAP.keys())


def _update_single_product(
    session: requests.Session,
    product_data: dict,
    changes: dict,
) -> dict:
    """Actualiza un producto en Shopify. changes = {field_name: new_value}."""
    graphql_url = settings.get_graphql_url()
    sku = product_data["sku"]
    title = product_data["title"]
    product_id = product_data["product_id"]
    variant_id = product_data["variant_id"]
    fields_updated = []

    try:
        # --- Product-level update (title, vendor, description, metafields) ---
        product_input: dict = {"id": product_id}
        has_product_update = False

        if "Titulo" in changes:
            product_input["title"] = changes["Titulo"]
            has_product_update = True

        if "Sipnosis" in changes:
            product_input["descriptionHtml"] = changes["Sipnosis"]
            has_product_update = True

        if "Vendor" in changes:
            product_input["vendor"] = changes["Vendor"]
            has_product_update = True

        # Metafields
        metafields = []
        for field_name, (ns, key, mtype) in _METAFIELD_KEY_MAP.items():
            if field_name in changes:
                val = changes[field_name]
                if mtype.startswith("list.") and not val.startswith("["):
                    val = json.dumps([val])
                metafields.append({
                    "namespace": ns, "key": key, "value": val, "type": mtype,
                })

        if metafields:
            product_input["metafields"] = metafields
            has_product_update = True

        if has_product_update:
            resp = None
            for attempt in range(_MAX_RETRIES):
                _throttler.wait_if_needed()
                resp = session.post(
                    graphql_url,
                    json={"query": _PRODUCT_UPDATE_MUTATION, "variables": {"input": product_input}},
                    timeout=30,
                )
                _throttler.update_from_response(resp)
                if resp.status_code == 429:
                    time.sleep(_throttler.handle_429(resp))
                    continue
                break

            if resp and resp.status_code == 200:
                data = resp.json()
                user_errors = data.get("data", {}).get("productUpdate", {}).get("userErrors", [])
                if user_errors:
                    error_msg = "; ".join(e.get("message", "") for e in user_errors)
                    return {"sku": sku, "title": title, "success": False, "error": error_msg}
                fields_updated.extend(
                    [f for f in changes if f in _PRODUCT_FIELDS or f in _METAFIELD_FIELDS]
                )
            elif resp:
                return {"sku": sku, "title": title, "success": False, "error": f"HTTP {resp.status_code}"}

        # --- Variant-level update (price, compareAtPrice, weight) ---
        variant_changes = {f: changes[f] for f in _VARIANT_FIELDS if f in changes}
        if variant_changes:
            variant_input: dict = {"id": variant_id}

            if "Precio" in variant_changes:
                variant_input["price"] = str(variant_changes["Precio"])
            if "Precio de comparacion" in variant_changes:
                variant_input["compareAtPrice"] = str(variant_changes["Precio de comparacion"])
            if "Peso (kg)" in variant_changes:
                inv_item: dict = {}
                inv_item["measurement"] = {
                    "weight": {"value": float(variant_changes["Peso (kg)"]), "unit": "KILOGRAMS"}
                }
                variant_input["inventoryItem"] = inv_item

            resp = None
            for attempt in range(_MAX_RETRIES):
                _throttler.wait_if_needed()
                resp = session.post(
                    graphql_url,
                    json={
                        "query": _VARIANT_UPDATE_MUTATION,
                        "variables": {"productId": product_id, "variants": [variant_input]},
                    },
                    timeout=30,
                )
                _throttler.update_from_response(resp)
                if resp.status_code == 429:
                    time.sleep(_throttler.handle_429(resp))
                    continue
                break

            if resp and resp.status_code == 200:
                data = resp.json()
                user_errors = (
                    data.get("data", {})
                    .get("productVariantsBulkUpdate", {})
                    .get("userErrors", [])
                )
                if user_errors:
                    error_msg = "; ".join(e.get("message", "") for e in user_errors)
                    return {"sku": sku, "title": title, "success": False, "error": error_msg}
                fields_updated.extend([f for f in variant_changes])
            elif resp:
                return {"sku": sku, "title": title, "success": False, "error": f"HTTP {resp.status_code}"}

        # --- Media update (image) ---
        if "Portada (URL)" in changes:
            img_url = changes["Portada (URL)"]
            if _is_valid_image_url(img_url):
                resp = None
                for attempt in range(_MAX_RETRIES):
                    _throttler.wait_if_needed()
                    resp = session.post(
                        graphql_url,
                        json={
                            "query": _PRODUCT_CREATE_MEDIA_MUTATION,
                            "variables": {
                                "productId": product_id,
                                "media": [{"originalSource": img_url, "alt": f"Libro {title} {sku}", "mediaContentType": "IMAGE"}],
                            },
                        },
                        timeout=30,
                    )
                    _throttler.update_from_response(resp)
                    if resp.status_code == 429:
                        time.sleep(_throttler.handle_429(resp))
                        continue
                    break
                if resp.status_code == 200:
                    data = resp.json()
                    media_errors = (
                        data.get("data", {})
                        .get("productCreateMedia", {})
                        .get("mediaUserErrors", [])
                    )
                    if not media_errors:
                        fields_updated.append("Portada (URL)")
                    else:
                        print(f"[UPDATE] Media error for SKU {sku}: {media_errors}", flush=True)

        return {
            "sku": sku,
            "title": title,
            "success": True,
            "fields_updated": fields_updated,
        }

    except Exception as e:
        return {"sku": sku, "title": title, "success": False, "error": str(e)}


def update_products_batch(
    products_data: list,
    changes_per_product: list,
) -> list:
    """
    Actualiza productos en Shopify con concurrencia.
    products_data: lista de dicts con {sku, product_id, variant_id, title}
    changes_per_product: lista de dicts con {field: new_value} (mismos indices que products_data)
    """
    headers = settings.get_shopify_headers()
    session = requests.Session()
    session.headers.update(headers)

    results = []
    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(_update_single_product, session, prod, chg): i
            for i, (prod, chg) in enumerate(zip(products_data, changes_per_product))
        }
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda r: r.get("sku", ""))
    return results


def _extract_categoria(metafields_edges: list) -> str:
    """Extrae categoría de los metafields de un producto."""
    for meta_edge in metafields_edges:
        meta = meta_edge.get("node", {})
        key = meta.get("key", "").lower()
        if key == "categoria" or key == "category" or "categoria" in key:
            valor = meta.get("value", "")
            return (
                valor.replace('["', "").replace('"]', "")
                .replace("[", "").replace("]", "")
                .replace('"', "").strip()
            )
    return "---"


def process_batch_info(
    session: requests.Session,
    isbn_batch: list[str],
    isbn_to_qty: dict,
) -> dict:
    """Procesa un batch de ISBNs para consulta de información."""
    graphql_url = settings.get_graphql_url()
    results = {}

    try:
        query = _build_batch_query(isbn_batch)
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)

        if response.status_code == 200:
            data = response.json()
            edges = (
                data.get("data", {})
                .get("productVariants", {})
                .get("edges", [])
            )

            for edge in edges:
                node = edge["node"]
                sku = str(node.get("sku", "")).strip()
                barcode = str(node.get("barcode", "")).strip()

                matched_isbn = None
                for isbn in isbn_batch:
                    if sku == isbn or barcode == isbn:
                        matched_isbn = isbn
                        break

                if matched_isbn and matched_isbn not in results:
                    product_gid = node["product"].get("id", "")
                    product_id = product_gid.split("/")[-1] if product_gid else "---"
                    variant_gid = node.get("id", "")
                    variant_id = variant_gid.split("/")[-1] if variant_gid else "---"
                    metafields = node["product"].get("metafields", {}).get("edges", [])

                    results[matched_isbn] = {
                        "ISBN": matched_isbn,
                        "ID": product_id,
                        "Variant ID": variant_id,
                        "Titulo": node["product"]["title"],
                        "Vendor": node["product"].get("vendor") or "---",
                        "Precio": float(node.get("price", 0)),
                        "Categoria": _extract_categoria(metafields),
                        "Cantidad": isbn_to_qty.get(matched_isbn, 0),
                    }
    except Exception:
        pass

    # Marcar no encontrados
    for isbn in isbn_batch:
        if isbn not in results:
            results[isbn] = {
                "ISBN": isbn,
                "ID": "---",
                "Variant ID": "---",
                "Titulo": "No encontrado",
                "Vendor": "---",
                "Precio": 0.0,
                "Categoria": "---",
                "Cantidad": isbn_to_qty.get(isbn, 0),
            }

    return results


def search_products(isbn_list: list[str], isbn_to_qty: dict) -> list[dict]:
    """
    Busca productos en Shopify por lista de ISBNs.
    Retorna lista de resultados ordenados según el orden original.
    """
    headers = settings.get_shopify_headers()
    batches = list(chunk_list(isbn_list, settings.BATCH_SIZE))

    all_results = {}
    session = requests.Session()
    session.headers.update(headers)

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(process_batch_info, session, batch, isbn_to_qty): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            all_results.update(future.result())

    # Mantener orden original
    return [all_results[isbn] for isbn in isbn_list if isbn in all_results]


# ---------------------------------------------------------------------------
# Inventario multi-bodega
# ---------------------------------------------------------------------------

def process_batch_inventory(
    session: requests.Session,
    isbn_batch: list[str],
    isbn_to_qty: dict,
    selected_locations: list[tuple],
    sales_data: dict | None = None,
) -> dict:
    """Procesa un batch de ISBNs para inventario multi-bodega."""
    graphql_url = settings.get_graphql_url()
    rest_url = settings.get_rest_url()
    headers = settings.get_shopify_headers()

    results = {}
    inventory_items = {}

    try:
        query = _build_batch_query(isbn_batch)
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)

        if response.status_code == 200:
            data = response.json()
            edges = (
                data.get("data", {})
                .get("productVariants", {})
                .get("edges", [])
            )

            for edge in edges:
                node = edge["node"]
                sku = str(node.get("sku", "")).strip()
                barcode = str(node.get("barcode", "")).strip()

                matched_isbn = None
                for isbn in isbn_batch:
                    if sku == isbn or barcode == isbn:
                        matched_isbn = isbn
                        break

                if matched_isbn and matched_isbn not in results:
                    inv_item_gid = node["inventoryItem"]["id"]
                    inv_item_id = inv_item_gid.split("/")[-1]
                    inventory_items[matched_isbn] = inv_item_id

                    item = {
                        "ISBN": matched_isbn,
                        "Title": node["product"]["title"],
                        "Vendor": node["product"].get("vendor") or "---",
                        "Solicitado": isbn_to_qty.get(matched_isbn, 0),
                    }

                    if sales_data is not None:
                        ventas = sales_data.get(sku, 0)
                        if ventas == 0 and barcode:
                            ventas = sales_data.get(barcode, 0)
                        item["Ventas 12M"] = ventas

                    for b_name, _ in selected_locations:
                        item[b_name] = 0

                    results[matched_isbn] = item

            # Consultar inventario por bodega
            if inventory_items:
                inv_ids = ",".join(inventory_items.values())
                inv_url = f"{rest_url}/inventory_levels.json"
                inv_id_to_isbn = {v: k for k, v in inventory_items.items()}

                for b_name, b_id in selected_locations:
                    try:
                        _throttler.wait_if_needed()
                        inv_response = session.get(
                            inv_url,
                            params={
                                "inventory_item_ids": inv_ids,
                                "location_ids": str(b_id),
                            },
                            timeout=15,
                        )
                        _throttler.update_from_response(inv_response)
                        if inv_response.status_code == 200:
                            levels = inv_response.json().get("inventory_levels", [])
                            for level in levels:
                                inv_item_id = str(level.get("inventory_item_id"))
                                available = level.get("available", 0)
                                isbn = inv_id_to_isbn.get(inv_item_id)
                                if isbn and isbn in results:
                                    results[isbn][b_name] = available if available else 0
                    except Exception:
                        pass

    except Exception:
        pass

    # No encontrados
    for isbn in isbn_batch:
        if isbn not in results:
            item = {
                "ISBN": isbn,
                "Title": "No encontrado",
                "Vendor": "---",
                "Solicitado": isbn_to_qty.get(isbn, 0),
            }
            if sales_data is not None:
                item["Ventas 12M"] = 0
            for b_name, _ in selected_locations:
                item[b_name] = 0
            results[isbn] = item

    return results


def search_inventory(
    isbn_list: list[str],
    isbn_to_qty: dict,
    location_names: list[str],
    sales_data: dict | None = None,
) -> list[dict]:
    """
    Busca inventario multi-bodega en Shopify.
    location_names: lista de nombres de bodegas a consultar.
    """
    headers = settings.get_shopify_headers()
    loc_map = get_locations()

    # Filtrar solo las bodegas solicitadas que existen
    selected_locations = [
        (name, loc_map[name]) for name in location_names if name in loc_map
    ]

    if not selected_locations:
        return []

    batches = list(chunk_list(isbn_list, settings.BATCH_SIZE))
    all_results = {}
    session = requests.Session()
    session.headers.update(headers)

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                process_batch_inventory,
                session,
                batch,
                isbn_to_qty,
                selected_locations,
                sales_data,
            ): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            all_results.update(future.result())

    return [all_results[isbn] for isbn in isbn_list if isbn in all_results]


# ---------------------------------------------------------------------------
# Ventas Bulk Operations (últimos 12 meses)
# ---------------------------------------------------------------------------

def start_bulk_operation() -> tuple[str | None, str | None]:
    """Inicia Bulk Operation para exportar órdenes de los últimos 12 meses."""
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()
    date_12m_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%dT00:00:00Z")

    mutation = """
    mutation {
      bulkOperationRunQuery(
        query: \"\"\"
        {
          orders(query: "created_at:>=%s AND financial_status:paid") {
            edges {
              node {
                id
                lineItems {
                  edges {
                    node {
                      sku
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
        \"\"\"
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
    """ % date_12m_ago

    try:
        response = requests.post(
            graphql_url, json={"query": mutation}, headers=headers, timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            if "errors" in data:
                return None, f"Error GraphQL: {data['errors']}"

            bulk_result = data.get("data", {}).get("bulkOperationRunQuery")
            if bulk_result:
                user_errors = bulk_result.get("userErrors", [])
                if user_errors:
                    return None, "; ".join(e.get("message", "") for e in user_errors)
                if bulk_result.get("bulkOperation"):
                    return bulk_result["bulkOperation"]["id"], None

        return None, f"HTTP {response.status_code}"
    except Exception as e:
        return None, str(e)


def check_bulk_operation_status() -> dict:
    """Verifica el estado de la Bulk Operation actual."""
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()

    query = """
    {
      currentBulkOperation {
        id status errorCode createdAt completedAt objectCount fileSize url
      }
    }
    """

    try:
        response = requests.post(
            graphql_url, json={"query": query}, headers=headers, timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            op = data.get("data", {}).get("currentBulkOperation")
            if op:
                return {
                    "status": op.get("status"),
                    "url": op.get("url"),
                    "object_count": op.get("objectCount", 0),
                    "error_code": op.get("errorCode"),
                    "created_at": op.get("createdAt"),
                    "completed_at": op.get("completedAt"),
                }
    except Exception:
        pass

    return {"status": None, "url": None, "object_count": 0}


def start_bulk_operation_reposiciones(date_range_days: int = 180) -> tuple[str | None, str | None]:
    """
    Inicia Bulk Operation para exportar ventas históricas de reposiciones.
    IMPORTANTE: Distinta a start_bulk_operation() — usa currentQuantity, incluye createdAt,
    filtra por financial_status:paid, y tiene rango de días configurable.
    NO modificar start_bulk_operation() — la usa el módulo ingreso.

    Returns: (operation_id, error_message) — uno de los dos siempre es None
    """
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()
    date_start = (datetime.now() - timedelta(days=date_range_days)).strftime("%Y-%m-%dT00:00:00Z")

    mutation = """
    mutation {
      bulkOperationRunQuery(
        query: \"\"\"
        {
          orders(query: "created_at:>=%s AND financial_status:paid") {
            edges {
              node {
                id
                createdAt
                lineItems {
                  edges {
                    node {
                      sku
                      currentQuantity
                    }
                  }
                }
              }
            }
          }
        }
        \"\"\"
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
    """ % date_start

    try:
        response = requests.post(
            graphql_url, json={"query": mutation}, headers=headers, timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            if "errors" in data:
                return None, f"Error GraphQL: {data['errors']}"
            bulk_result = data.get("data", {}).get("bulkOperationRunQuery")
            if bulk_result:
                user_errors = bulk_result.get("userErrors", [])
                if user_errors:
                    return None, "; ".join(e.get("message", "") for e in user_errors)
                if bulk_result.get("bulkOperation"):
                    return bulk_result["bulkOperation"]["id"], None
        return None, f"HTTP {response.status_code}"
    except Exception as e:
        return None, str(e)


def download_and_process_bulk_results(url: str) -> dict:
    """Descarga JSONL de resultados y procesa ventas por SKU."""
    sales_by_sku = {}

    try:
        response = requests.get(url, timeout=120, stream=True)
        if response.status_code == 200:
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode("utf-8"))
                        if "sku" in data and "quantity" in data:
                            sku = str(data.get("sku", "")).strip()
                            if sku:
                                quantity = data.get("quantity", 0)
                                sales_by_sku[sku] = sales_by_sku.get(sku, 0) + quantity
                    except json.JSONDecodeError:
                        continue
    except Exception:
        pass

    return sales_by_sku


# ---------------------------------------------------------------------------
# Creación de productos
# ---------------------------------------------------------------------------

_PRODUCT_CREATE_MUTATION = """
mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
  productCreate(product: $product, media: $media) {
    product {
      id
      title
      variants(first: 1) { nodes { id } }
    }
    userErrors { field message }
  }
}
"""

_VARIANT_UPDATE_MUTATION = """
mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id sku }
    userErrors { field message }
  }
}
"""


_PRODUCT_UPDATE_MUTATION = """
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
"""

_PRODUCT_CREATE_MEDIA_MUTATION = """
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id }
    mediaUserErrors { field message }
  }
}
"""

_PUBLISHABLE_PUBLISH_MUTATION = """
mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable { availablePublicationsCount { count } }
    userErrors { field message }
  }
}
"""

_PUBLICATIONS_QUERY = """
{
  publications(first: 20) {
    nodes {
      id
      name
    }
  }
}
"""

# Cache de publication IDs para no consultar en cada producto
_publication_ids_cache: list[str] = []
_publication_ids_lock = threading.Lock()


def _get_publication_ids(session: requests.Session) -> list[str]:
    """Obtiene los IDs de todas las publicaciones (Sales Channels) de la tienda. Cachea el resultado."""
    with _publication_ids_lock:
        if _publication_ids_cache:
            return _publication_ids_cache

    graphql_url = settings.get_graphql_url()
    try:
        response = session.post(
            graphql_url,
            json={"query": _PUBLICATIONS_QUERY},
            timeout=15,
        )
        if response.status_code == 200:
            data = response.json()
            nodes = data.get("data", {}).get("publications", {}).get("nodes", [])
            ids = [n["id"] for n in nodes if n.get("id")]
            with _publication_ids_lock:
                _publication_ids_cache.clear()
                _publication_ids_cache.extend(ids)
            return ids
    except Exception:
        pass
    return []


def _publish_product(session: requests.Session, product_id: str, publication_ids: list[str]) -> None:
    """Publica un producto en todos los Sales Channels disponibles."""
    if not publication_ids:
        return
    graphql_url = settings.get_graphql_url()
    pub_input = [{"publicationId": pid} for pid in publication_ids]
    try:
        _throttler.wait_if_needed()
        resp = session.post(
            graphql_url,
            json={
                "query": _PUBLISHABLE_PUBLISH_MUTATION,
                "variables": {"id": product_id, "input": pub_input},
            },
            timeout=15,
        )
        _throttler.update_from_response(resp)
    except Exception:
        pass  # No fallar la creación si la publicación falla

_MIN_IMAGE_SIZE = 1024  # 1 KB — placeholder images are typically < 100 bytes


def _is_valid_image_url(url: str, retries: int = 2) -> bool:
    """Verifica que la URL apunte a una imagen real (no un placeholder transparente).
    Reintenta hasta `retries` veces ante fallos temporales."""
    for attempt in range(retries + 1):
        try:
            resp = requests.head(url, timeout=5, allow_redirects=True)
            if resp.status_code != 200:
                if attempt < retries:
                    time.sleep(0.5)
                    continue
                return False
            content_length = resp.headers.get("Content-Length")
            if content_length and int(content_length) >= _MIN_IMAGE_SIZE:
                return True
            # Algunos servidores no envían Content-Length en HEAD; hacer GET parcial
            resp = requests.get(url, timeout=5, stream=True, headers={"Range": "bytes=0-1023"})
            chunk = resp.raw.read(1024)
            resp.close()
            return len(chunk) >= _MIN_IMAGE_SIZE
        except Exception:
            if attempt < retries:
                time.sleep(0.5)
                continue
            return False
    return False


def validate_image_urls(urls: list[str]) -> dict[str, bool]:
    """Valida múltiples URLs de imagen en paralelo. Retorna {url: is_valid}."""
    results = {}
    with ThreadPoolExecutor(max_workers=min(len(urls), 10)) as executor:
        futures = {executor.submit(_is_valid_image_url, url): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            results[url] = future.result()
    return results


def _build_product_input(row: dict) -> tuple[dict, list]:
    """Construye el input de productCreate a partir de una fila del DataFrame procesado."""
    metafields = []

    # Mapeo de columnas de metafield a namespace/key/type
    _METAFIELD_COLS = {
        "Metafield: custom.autor [single_line_text_field]": ("custom", "autor", "single_line_text_field"),
        "Metafield: custom.idioma [list.single_line_text_field]": ("custom", "idioma", "list.single_line_text_field"),
        "Metafield: custom.formato [list.single_line_text_field]": ("custom", "formato", "list.single_line_text_field"),
        "Metafield: custom.alto [dimension]": ("custom", "alto", "dimension"),
        "Metafield: custom.ancho [dimension]": ("custom", "ancho", "dimension"),
        "Metafield: custom.editorial [single_line_text_field]": ("custom", "editorial", "single_line_text_field"),
        "Metafield: custom.numero_de_paginas [number_integer]": ("custom", "numero_de_paginas", "number_integer"),
        "Metafield: custom.ilustrador [single_line_text_field]": ("custom", "ilustrador", "single_line_text_field"),
        "Metafield: custom.categoria [single_line_text_field]": ("custom", "categoria", "list.single_line_text_field"),
        "Metafield: custom.subcategoria [single_line_text_field]": ("custom", "subcategoria", "list.single_line_text_field"),
    }

    for col, (ns, key, mtype) in _METAFIELD_COLS.items():
        val = row.get(col)
        if val is not None and str(val).strip() and str(val).lower() != "nan":
            str_val = str(val)
            # list.* types need JSON array format; wrap if not already
            if mtype.startswith("list.") and not str_val.startswith("["):
                str_val = json.dumps([str_val])
            metafields.append({
                "namespace": ns,
                "key": key,
                "value": str_val,
                "type": mtype,
            })

    product_input = {
        "title": str(row.get("Title", "")),
        "handle": str(row.get("Handle", "")),
        "descriptionHtml": "" if not row.get("Body HTML") or str(row.get("Body HTML")).lower() == "nan" else str(row.get("Body HTML")),
        "vendor": str(row.get("Vendor", "")),
        "productType": str(row.get("Type", "Libro")),
        "status": "ACTIVE",
    }

    if metafields:
        product_input["metafields"] = metafields

    # Media (imagen) — usa resultado pre-validado si existe, sino valida inline
    media = []
    img_src = row.get("Image Src")
    if img_src and str(img_src).strip() and str(img_src).lower() != "nan":
        is_valid = row.get("_image_validated")
        if is_valid is None:
            is_valid = _is_valid_image_url(str(img_src))
        if is_valid:
            alt = str(row.get("Image Alt Text", "")) or ""
            media.append({
                "originalSource": str(img_src),
                "alt": alt,
                "mediaContentType": "IMAGE",
            })

    return product_input, media


_MAX_RETRIES = 3


def _create_single_product(session: requests.Session, row: dict) -> dict:
    """Crea un único producto en Shopify (2 pasos: producto + variante). Retorna resultado."""
    graphql_url = settings.get_graphql_url()
    sku = str(row.get("Variant SKU", "???"))
    title = str(row.get("Title", "???"))

    try:
        # Paso 1: Crear producto (sin variantes)
        product_input, media = _build_product_input(row)
        variables: dict = {"product": product_input}
        if media:
            variables["media"] = media

        response = None
        for attempt in range(_MAX_RETRIES):
            _throttler.wait_if_needed()
            response = session.post(
                graphql_url,
                json={"query": _PRODUCT_CREATE_MUTATION, "variables": variables},
                timeout=30,
            )
            _throttler.update_from_response(response)

            if response.status_code == 429:
                wait_secs = _throttler.handle_429(response)
                time.sleep(wait_secs)
                continue
            break

        if response is None or response.status_code != 200:
            status = response.status_code if response is not None else "N/A"
            return {"sku": sku, "title": title, "success": False, "error": f"HTTP {status}"}

        data = response.json()

        if "errors" in data:
            error_msg = "; ".join(e.get("message", "") for e in data["errors"])
            return {"sku": sku, "title": title, "success": False, "error": error_msg}

        result = data.get("data", {}).get("productCreate", {})
        user_errors = result.get("userErrors", [])
        if user_errors:
            error_msg = "; ".join(e.get("message", "") for e in user_errors)
            return {"sku": sku, "title": title, "success": False, "error": error_msg}

        product = result.get("product", {})
        product_id = product.get("id", "")

        # Obtener ID de la variante default creada automáticamente
        variant_nodes = product.get("variants", {}).get("nodes", [])
        variant_id = variant_nodes[0]["id"] if variant_nodes else None

        # Paso 2: Actualizar variante con SKU, precio, barcode, peso
        if variant_id:
            variant_input: dict = {
                "id": variant_id,
                "barcode": str(row.get("Variant Barcode", "")),
                "taxable": False,
                "inventoryPolicy": "DENY",
            }

            # SKU, peso y tracking van dentro de inventoryItem
            inv_item: dict = {"sku": sku, "requiresShipping": True, "tracked": True}
            weight = row.get("Variant Weight")
            if weight is not None and str(weight).lower() != "nan":
                inv_item["measurement"] = {
                    "weight": {"value": float(weight), "unit": "KILOGRAMS"}
                }
            variant_input["inventoryItem"] = inv_item

            price = row.get("Variant Price")
            if price is not None and str(price).lower() != "nan":
                variant_input["price"] = str(price)

            compare_price = row.get("Variant Compare At Price")
            if compare_price is not None and str(compare_price).lower() != "nan":
                variant_input["compareAtPrice"] = str(compare_price)

            for attempt in range(_MAX_RETRIES):
                _throttler.wait_if_needed()
                variant_response = session.post(
                    graphql_url,
                    json={
                        "query": _VARIANT_UPDATE_MUTATION,
                        "variables": {
                            "productId": product_id,
                            "variants": [variant_input],
                        },
                    },
                    timeout=30,
                )
                _throttler.update_from_response(variant_response)

                if variant_response.status_code == 429:
                    wait_secs = _throttler.handle_429(variant_response)
                    time.sleep(wait_secs)
                    continue
                break

        # Paso 3: Publicar en todos los Sales Channels
        publication_ids = _get_publication_ids(session)
        if publication_ids:
            _publish_product(session, product_id, publication_ids)

        return {
            "sku": sku,
            "title": title,
            "success": True,
            "shopify_id": product_id,
        }

    except Exception as e:
        return {"sku": sku, "title": title, "success": False, "error": str(e)}


def check_existing_skus(skus: list[str]) -> set[str]:
    """Busca SKUs en Shopify y retorna el set de los que ya existen."""
    if not skus:
        return set()

    headers = settings.get_shopify_headers()
    graphql_url = settings.get_graphql_url()
    session = requests.Session()
    session.headers.update(headers)
    existing = set()

    batches = list(chunk_list(skus, settings.BATCH_SIZE))

    def _check_batch(batch: list[str]) -> set[str]:
        found = set()
        conditions = " OR ".join([f"sku:{_sanitize_graphql_value(sku)}" for sku in batch])
        query = """
        {
          productVariants(first: 250, query: "%s") {
            edges {
              node { sku }
            }
          }
        }
        """ % conditions
        try:
            _throttler.wait_if_needed()
            response = session.post(graphql_url, json={"query": query}, timeout=30)
            _throttler.update_from_response(response)
            if response.status_code == 200:
                data = response.json()
                edges = data.get("data", {}).get("productVariants", {}).get("edges", [])
                for edge in edges:
                    sku = str(edge["node"].get("sku", "")).strip()
                    if sku in batch:
                        found.add(sku)
        except Exception as e:
            print(f"[SKU CHECK] Error checking batch: {e}", flush=True)
        return found

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = [executor.submit(_check_batch, batch) for batch in batches]
        for future in as_completed(futures):
            existing.update(future.result())

    return existing


def create_products_batch(rows: list[dict]) -> list[dict]:
    """
    Crea productos en Shopify con concurrencia.
    Detecta duplicados automáticamente y los omite.
    rows: lista de dicts (filas del DataFrame procesado).
    Retorna lista de resultados por producto.
    """
    headers = settings.get_shopify_headers()
    session = requests.Session()
    session.headers.update(headers)

    # Extraer todos los SKUs y detectar duplicados en Shopify
    all_skus = [str(row.get("Variant SKU", "")) for row in rows]
    existing_skus = check_existing_skus(all_skus)

    new_rows = []
    skipped_results = []
    for row in rows:
        sku = str(row.get("Variant SKU", ""))
        title = str(row.get("Title", "???"))
        if sku in existing_skus:
            skipped_results.append({
                "sku": sku,
                "title": title,
                "success": False,
                "skipped": True,
                "error": "SKU ya existe en Shopify",
            })
        else:
            new_rows.append(row)

    # Pre-validar imágenes en paralelo para no hacerlo secuencialmente por producto
    image_urls = []
    for row in new_rows:
        img = row.get("Image Src")
        if img and str(img).strip() and str(img).lower() != "nan":
            image_urls.append(str(img).strip())
    if image_urls:
        valid_images = validate_image_urls(list(set(image_urls)))
        for row in new_rows:
            img = row.get("Image Src")
            if img and str(img).strip() and str(img).lower() != "nan":
                url = str(img).strip()
                row["_image_validated"] = valid_images.get(url, False)

    created_results = []
    if new_rows:
        with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
            futures = {
                executor.submit(_create_single_product, session, row): i
                for i, row in enumerate(new_rows)
            }
            for future in as_completed(futures):
                created_results.append(future.result())

    results = skipped_results + created_results
    # Ordenar por SKU para consistencia
    results.sort(key=lambda r: r.get("sku", ""))
    return results


def load_sales_sync() -> tuple[dict | None, str | None]:
    """
    Carga ventas usando Bulk Operations de forma síncrona.
    Espera hasta que termine (máximo ~10 min).
    Retorna (sales_data, error).
    """
    operation_id, error = start_bulk_operation()
    if error:
        return None, f"Error iniciando: {error}"
    if not operation_id:
        return None, "No se pudo iniciar la operación"

    max_attempts = 120
    for attempt in range(max_attempts):
        result = check_bulk_operation_status()
        status = result.get("status")

        if status == "COMPLETED":
            url = result.get("url")
            if url:
                sales_data = download_and_process_bulk_results(url)
                return sales_data, None
            return {}, None
        elif status == "FAILED":
            return None, "La operación falló en Shopify"
        elif status == "CANCELED":
            return None, "La operación fue cancelada"

        time.sleep(5)

    return None, "Timeout - la operación tardó demasiado"


# ---------------------------------------------------------------------------
# Reposiciones — vendors e inventory por location
# ---------------------------------------------------------------------------

def get_vendors_from_shopify() -> list[dict]:
    """
    Devuelve lista de proveedores únicos desde productos de Shopify con conteo de productos.
    Pagina con cursor hasta obtener todos los productos (Bukz tiene 150+ proveedores).
    Returns: [{"name": "Editorial X", "product_count": 42}, ...]
    """
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()

    vendor_counts: dict[str, int] = {}
    cursor = None

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          products(first: 250%s) {
            pageInfo { hasNextPage endCursor }
            edges {
              node { vendor }
            }
          }
        }
        """ % after_clause

        _throttler.wait_if_needed()
        try:
            resp = requests.post(
                graphql_url,
                json={"query": query},
                headers=headers,
                timeout=30,
            )
            _throttler.update_from_response(resp)
            if resp.status_code != 200:
                break

            data = resp.json().get("data", {}).get("products", {})
            for edge in data.get("edges", []):
                vendor = (edge.get("node") or {}).get("vendor", "").strip()
                if vendor:
                    vendor_counts[vendor] = vendor_counts.get(vendor, 0) + 1

            page_info = data.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")
        except Exception:
            break

    return [{"name": v, "product_count": c} for v, c in sorted(vendor_counts.items())]


def get_inventory_by_location(location_gid: str, vendor_filter: list[str] | None = None) -> list[dict]:
    """
    Devuelve niveles de inventario (available) para todos los productos en una sede de Shopify.
    Filtra por vendor si vendor_filter no es None ni vacío.

    Args:
        location_gid: GID de Shopify, e.g. "gid://shopify/Location/12345"
        vendor_filter: lista de nombres de proveedor exactos; None o [] = todos

    Returns: [{"sku": str, "title": str, "vendor": str, "available": int}, ...]
    """
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()

    results: list[dict] = []
    cursor = None

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          location(id: "%s") {
            inventoryLevels(first: 250%s) {
              pageInfo { hasNextPage endCursor }
              edges {
                node {
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                  item {
                    sku
                    variant {
                      product {
                        vendor
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """ % (location_gid, after_clause)

        _throttler.wait_if_needed()
        try:
            resp = requests.post(
                graphql_url,
                json={"query": query},
                headers=headers,
                timeout=30,
            )
            _throttler.update_from_response(resp)
            if resp.status_code != 200:
                break

            location_data = resp.json().get("data", {}).get("location") or {}
            inv_levels = location_data.get("inventoryLevels", {})

            for edge in inv_levels.get("edges", []):
                node = edge.get("node", {})
                item = node.get("item", {})
                sku = (item.get("sku") or "").strip()
                variant = (item.get("variant") or {})
                product = (variant.get("product") or {})
                vendor = (product.get("vendor") or "").strip()
                title = (product.get("title") or "").strip()

                # Filtrar por vendor si se especificó
                if vendor_filter and vendor not in vendor_filter:
                    continue

                available = 0
                for qty_entry in node.get("quantities", []):
                    if qty_entry.get("name") == "available":
                        available = int(qty_entry.get("quantity") or 0)
                        break

                if sku:
                    results.append({
                        "sku": sku,
                        "title": title,
                        "vendor": vendor,
                        "available": available,
                    })

            page_info = inv_levels.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")
        except Exception:
            break

    return results


def get_all_products_catalog() -> list[dict]:
    """
    Pagina a través de TODOS los productos de Shopify y devuelve un catálogo
    de SKU→vendor+title para cada variante.

    Returns: [{"sku": str, "vendor": str, "title": str}, ...]
    """
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()

    results: list[dict] = []
    cursor = None

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          products(first: 250%s) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                vendor
                title
                variants(first: 100) {
                  edges {
                    node {
                      sku
                    }
                  }
                }
              }
            }
          }
        }
        """ % after_clause

        _throttler.wait_if_needed()
        try:
            resp = requests.post(
                graphql_url,
                json={"query": query},
                headers=headers,
                timeout=30,
            )
            _throttler.update_from_response(resp)

            if resp.status_code == 429:
                time.sleep(_throttler.handle_429(resp))
                continue

            if resp.status_code != 200:
                break

            products_data = resp.json().get("data", {}).get("products", {})

            for edge in products_data.get("edges", []):
                node = edge.get("node", {})
                vendor = (node.get("vendor") or "").strip()
                title = (node.get("title") or "").strip()

                for v_edge in node.get("variants", {}).get("edges", []):
                    v_node = v_edge.get("node", {})
                    sku = (v_node.get("sku") or "").strip()
                    if sku:
                        results.append({
                            "sku": sku,
                            "vendor": vendor,
                            "title": title,
                        })

            page_info = products_data.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")
        except Exception:
            break

    return results

"""
Servicio para consultar detalles de ordenes Shopify por nombre.
Usado por el modulo de Cortes para identificar regalos en promociones 3X2.
"""
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import settings


def chunk_list(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def _build_orders_query(order_names: list[str]) -> str:
    """Construye query GraphQL para buscar ordenes por nombre."""
    name_filter = " OR ".join(f"name:{n}" for n in order_names)
    return """
    {
      orders(first: %d, query: "%s") {
        edges {
          node {
            name
            lineItems(first: 50) {
              edges {
                node {
                  sku
                  title
                  quantity
                  originalUnitPriceSet {
                    shopMoney { amount }
                  }
                  discountAllocations {
                    allocatedAmountSet {
                      shopMoney { amount }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """ % (len(order_names), name_filter)


def _process_order_node(node: dict) -> tuple[str, list[dict]]:
    """Extrae line items de un nodo de orden GraphQL."""
    name = node.get("name", "")
    line_items = []

    for edge in node.get("lineItems", {}).get("edges", []):
        li = edge["node"]
        sku = str(li.get("sku") or "").strip()
        title = li.get("title", "")
        quantity = li.get("quantity", 1)

        unit_price = float(
            li.get("originalUnitPriceSet", {})
            .get("shopMoney", {})
            .get("amount", "0")
        )

        total_discount = 0.0
        for alloc in li.get("discountAllocations", []):
            total_discount += float(
                alloc.get("allocatedAmountSet", {})
                .get("shopMoney", {})
                .get("amount", "0")
            )

        # Descuento por unidad
        discount_per_unit = total_discount / quantity if quantity > 0 else total_discount
        discounted_price = unit_price - discount_per_unit

        line_items.append({
            "sku": sku,
            "title": title,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_discount": total_discount,
            "discount_per_unit": discount_per_unit,
            "discounted_price": max(discounted_price, 0),
            "is_free": discounted_price <= 0.01 and unit_price > 0,
        })

    return name, line_items


def _fetch_batch(session: requests.Session, order_names: list[str]) -> dict[str, list[dict]]:
    """Consulta un batch de ordenes en Shopify GraphQL."""
    graphql_url = settings.get_graphql_url()
    query = _build_orders_query(order_names)
    results = {}

    try:
        response = session.post(
            graphql_url,
            json={"query": query},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            edges = data.get("data", {}).get("orders", {}).get("edges", [])
            for edge in edges:
                name, line_items = _process_order_node(edge["node"])
                if name:
                    results[name] = line_items
    except Exception as e:
        print(f"[ORDERS] Error fetching batch: {e}", flush=True)

    return results


def get_orders_details(order_names: list[str]) -> dict[str, list[dict]]:
    """
    Consulta detalles de ordenes Shopify por nombre.
    Retorna dict {order_name: [line_items...]}.
    """
    if not order_names:
        return {}

    headers = settings.get_shopify_headers()
    session = requests.Session()
    session.headers.update(headers)

    batches = list(chunk_list(order_names, 10))
    all_results = {}

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(_fetch_batch, session, batch): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            all_results.update(future.result())

    return all_results


def identify_gifts(line_items: list[dict]) -> dict[str, int]:
    """
    Identifica los SKUs regalados en una orden 3X2.
    Usa dos metodos y toma el mayor:
      - Conteo: total_unidades // 3
      - Descuento: cuantas unidades cubre el descuento total por line item
    Retorna dict {sku: cantidad_regalada}.
    """
    if not line_items:
        return {}

    # Expandir line items por cantidad para tener 1 entrada por unidad
    units: list[dict] = []
    for li in line_items:
        for _ in range(li.get("quantity", 1)):
            units.append(li)

    # Metodo 1: por conteo (cada 3 libros, 1 regalo)
    gifts_by_count = len(units) // 3

    # Metodo 2: por descuento (cuantas unidades cubre el descuento)
    gifts_by_discount = 0
    for li in line_items:
        unit_price = li.get("unit_price", 0)
        total_discount = li.get("total_discount", 0)
        if unit_price > 0 and total_discount > 0:
            gifts_by_discount += int(total_discount / unit_price + 0.01)

    num_gifts = max(gifts_by_count, gifts_by_discount)
    if num_gifts == 0:
        return {}

    # Ordenar por precio unitario ascendente (los mas baratos primero)
    units_sorted = sorted(units, key=lambda x: x.get("unit_price", float("inf")))

    # Los N mas baratos son regalos (sin exceder total de unidades)
    num_gifts = min(num_gifts, len(units_sorted))
    gifts: dict[str, int] = {}
    for i in range(num_gifts):
        sku = units_sorted[i]["sku"]
        gifts[sku] = gifts.get(sku, 0) + 1

    return gifts

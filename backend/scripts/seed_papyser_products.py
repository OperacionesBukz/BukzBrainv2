"""
Sembrar el catálogo Papyser (16 productos) en Firestore — idempotente.

Uso:
    cd backend
    ./venv/Scripts/python.exe scripts/seed_papyser_products.py            # dry-run
    ./venv/Scripts/python.exe scripts/seed_papyser_products.py --apply    # escribe en Firestore

Idempotente: upsert por `code`. No toca productos ajenos al catálogo Papyser.
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from services.firebase_service import get_firestore_db


CATALOGO_PAPYSER = [
    ("0504739", "Bolsa Basura 65x90 cm Negra x 12 Calibre 0.8", "Limpieza"),
    ("9614366", "Borrador Nata 624 (pequeño)", "Papelería"),
    ("1006039", "Café Molido Bastilla Fuerte x 2500 g", "Cafetería"),
    ("8823276", "Cinta Empaque Transparente 48 mm x 100 mt", "Papelería"),
    ("8824012", "Cinta Transparente 12 mm x 20 mt", "Papelería"),
    ("8824014", "Cinta Transparente 12 mm x 40 mt", "Papelería"),
    ("0520400", "Jabón Líquido Manos Berhlan Antibacterial Avena con Válvula x 1000 ml", "Limpieza"),
    ("0504970", "Jabón Líquido Todo Uso Lavaloza Limón Berhlan x 1000 ml", "Limpieza"),
    ("0508165", "Limpiador Multiuso Líquido Lavanda Yilop x 3800 ml", "Limpieza"),
    ("1028528", "Mezclador Madera Redondo Bambú x 500", "Cafetería"),
    ("8453054", "Nota Adhesiva Mediana Neón x 400 h Colores", "Papelería"),
    ("2455042", "Papel Bond 75 g Carta x 500 h", "Papelería"),
    ("0534076", "Papel Higiénico Normal 201647 x 1x26 mt Blanco", "Limpieza"),
    ("4761334", "Pila Alcalina AAA Energizer x 2", "Papelería"),
    ("3270895", "Rollo Térmico Facturas 57 x 30 mt", "Papelería"),
    ("1040580", "Servilleta Acolchamax 200115 x 100 Und Blanco Tork", "Cafetería"),
]

CATEGORIAS_REQUERIDAS = ["Papelería", "Limpieza", "Cafetería"]


def asegurar_categorias(db, apply: bool) -> int:
    existentes = {doc.to_dict().get("name") for doc in db.collection("product_categories").stream()}
    creadas = 0
    for cat in CATEGORIAS_REQUERIDAS:
        if cat in existentes:
            print(f"  [EXISTE     ] Categoría {cat}")
            continue
        if apply:
            db.collection("product_categories").add({
                "name": cat,
                "createdAt": firestore.SERVER_TIMESTAMP,
            })
        print(f"  [{'CREADA' if apply else 'SE CREARÍA':11}] Categoría {cat}")
        creadas += 1
    return creadas


def upsert_producto(db, codigo: str, nombre: str, categoria: str, apply: bool) -> str:
    matches = list(
        db.collection("products")
        .where(filter=FieldFilter("code", "==", codigo))
        .limit(1)
        .stream()
    )
    if matches:
        doc_data = matches[0].to_dict()
        if doc_data.get("name") == nombre and doc_data.get("category") == categoria:
            return "SIN CAMBIOS"
        if apply:
            matches[0].reference.update({"name": nombre, "category": categoria})
        return "ACTUALIZADO" if apply else "SE ACTUALIZARÍA"

    if apply:
        db.collection("products").add({
            "name": nombre,
            "code": codigo,
            "category": categoria,
            "isVisible": True,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
    return "CREADO" if apply else "SE CREARÍA"


def main():
    apply = "--apply" in sys.argv
    modo = "APPLY (escribiendo en Firestore)" if apply else "DRY-RUN (solo previsualización, usar --apply para escribir)"
    print(f"=== Seed catálogo Papyser — {modo} ===\n")

    db = get_firestore_db()
    print(f"Proyecto Firestore: {db.project}\n")

    print("Categorías:")
    asegurar_categorias(db, apply)

    print("\nProductos:")
    contador = {}
    for codigo, nombre, categoria in CATALOGO_PAPYSER:
        accion = upsert_producto(db, codigo, nombre, categoria, apply)
        contador[accion] = contador.get(accion, 0) + 1
        print(f"  [{accion:16}] {codigo} | {nombre}")

    print(f"\nResumen: {contador}")
    if not apply:
        print("\nDry-run completo. Si todo se ve bien, corre con --apply para escribir.")


if __name__ == "__main__":
    main()

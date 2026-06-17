"""
Preview de la consolidación Papyser: genera el xlsx en Downloads y muestra el caption.
No toca Firestore ni envía WhatsApp.

Uso:
    cd backend
    ./venv/Scripts/python.exe scripts/preview_papyser_consolidation.py
"""
import io
import sys
from pathlib import Path

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter

from services.firebase_service import get_firestore_db
from routers.papyser import _agregar_items, _construir_xlsx, _construir_caption


def main():
    db = get_firestore_db()
    pendings = list(
        db.collection("bookstore_requests")
        .where(filter=FieldFilter("status", "==", "pending"))
        .stream()
    )
    print(f"Pedidos pending: {len(pendings)}")
    if not pendings:
        print("No hay nada para consolidar.")
        return

    agregado = _agregar_items(pendings)
    total_items = sum(info["total"] for info in agregado.values())
    sedes = sorted({(d.to_dict().get("branch") or "Sin sede") for d in pendings})

    print(f"Productos distintos: {len(agregado)}")
    print(f"Total unidades: {total_items}")
    print(f"Sedes: {sedes}")

    xlsx_bytes = _construir_xlsx(agregado)
    caption = _construir_caption(agregado)

    out_path = Path.home() / "Downloads" / f"preview-pedido-papyser-{datetime.now().strftime('%Y-%m-%d-%H%M')}.xlsx"
    out_path.write_bytes(xlsx_bytes)
    print(f"\n📂 xlsx generado: {out_path}")
    print(f"   tamaño: {len(xlsx_bytes)} bytes")

    print("\n" + "=" * 60)
    print("CAPTION (texto del WhatsApp):")
    print("=" * 60)
    print(caption)
    print("=" * 60)


if __name__ == "__main__":
    main()

"""
Router de Proveedores — CRUD completo sobre la colección `suppliers` en Firestore.
Reemplaza el dict hardcodeado PROVEEDORES_EMAIL de devoluciones.py.
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from pydantic import BaseModel

from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

COLLECTION = "suppliers"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SupplierCreate(BaseModel):
    empresa: str
    correo: str
    correos_cc: list[str] = []
    ciudad: str = ""
    nit: str = ""
    razonSocial: str = ""
    margen: float = 0
    estado: str = "Activo"
    tipo: str = "proveedor"


class SupplierUpdate(BaseModel):
    empresa: Optional[str] = None
    correo: Optional[str] = None
    correos_cc: Optional[list[str]] = None
    ciudad: Optional[str] = None
    nit: Optional[str] = None
    razonSocial: Optional[str] = None
    margen: Optional[float] = None
    estado: Optional[str] = None
    tipo: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_suppliers():
    """Lista todos los proveedores de la colección suppliers."""
    db = get_firestore_db()
    docs = db.collection(COLLECTION).order_by("empresa").stream()
    suppliers = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        suppliers.append(data)
    return {"suppliers": suppliers, "total": len(suppliers)}


@router.get("/by-name/{name}")
async def get_supplier_by_name(name: str):
    """Busca un proveedor por nombre exacto de empresa."""
    db = get_firestore_db()
    docs = (
        db.collection(COLLECTION)
        .where("empresa", "==", name)
        .limit(1)
        .stream()
    )
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    raise HTTPException(404, detail=f"Proveedor '{name}' no encontrado")


@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str):
    """Obtiene un proveedor por su ID de documento."""
    db = get_firestore_db()
    doc = db.collection(COLLECTION).document(supplier_id).get()
    if not doc.exists:
        raise HTTPException(404, detail=f"Proveedor con ID '{supplier_id}' no encontrado")
    data = doc.to_dict()
    data["id"] = doc.id
    return data


@router.post("")
async def create_supplier(supplier: SupplierCreate):
    """Crea un nuevo proveedor."""
    db = get_firestore_db()

    # Check for duplicate empresa name
    existing = (
        db.collection(COLLECTION)
        .where("empresa", "==", supplier.empresa)
        .limit(1)
        .stream()
    )
    for _ in existing:
        raise HTTPException(
            409, detail=f"Ya existe un proveedor con empresa '{supplier.empresa}'"
        )

    doc_data = supplier.model_dump()
    doc_data["createdAt"] = SERVER_TIMESTAMP
    doc_data["updatedAt"] = SERVER_TIMESTAMP
    doc_data["createdBy"] = "api"

    doc_ref = db.collection(COLLECTION).add(doc_data)
    doc_id = doc_ref[1].id

    return {"id": doc_id, "message": f"Proveedor '{supplier.empresa}' creado", **doc_data}


@router.put("/{supplier_id}")
async def update_supplier(supplier_id: str, supplier: SupplierUpdate):
    """Actualiza un proveedor existente."""
    db = get_firestore_db()
    doc_ref = db.collection(COLLECTION).document(supplier_id)

    if not doc_ref.get().exists:
        raise HTTPException(404, detail=f"Proveedor con ID '{supplier_id}' no encontrado")

    update_data = {k: v for k, v in supplier.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(400, detail="No se proporcionaron campos para actualizar")

    update_data["updatedAt"] = SERVER_TIMESTAMP
    doc_ref.update(update_data)

    return {"id": supplier_id, "message": "Proveedor actualizado", "updated_fields": list(update_data.keys())}


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str):
    """Elimina un proveedor."""
    db = get_firestore_db()
    doc_ref = db.collection(COLLECTION).document(supplier_id)

    if not doc_ref.get().exists:
        raise HTTPException(404, detail=f"Proveedor con ID '{supplier_id}' no encontrado")

    doc_ref.delete()
    return {"id": supplier_id, "message": "Proveedor eliminado"}


@router.post("/seed")
async def seed_suppliers():
    """
    Carga inicial de proveedores desde suppliers_seed.json.
    Idempotente: no crea duplicados si el proveedor ya existe por nombre.
    """
    seed_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "scripts", "suppliers_seed.json"
    )
    if not os.path.isfile(seed_path):
        raise HTTPException(404, detail="Archivo suppliers_seed.json no encontrado")

    with open(seed_path, "r", encoding="utf-8") as f:
        seed_data = json.load(f)

    db = get_firestore_db()

    # Build set of existing empresa names for idempotency
    existing_names: set[str] = set()
    for doc in db.collection(COLLECTION).stream():
        data = doc.to_dict()
        if "empresa" in data:
            existing_names.add(data["empresa"])

    created = 0
    skipped = 0

    for supplier in seed_data:
        if supplier["empresa"] in existing_names:
            skipped += 1
            continue

        supplier["createdAt"] = SERVER_TIMESTAMP
        supplier["updatedAt"] = SERVER_TIMESTAMP
        db.collection(COLLECTION).add(supplier)
        created += 1

    return {
        "message": f"Seed completado: {created} creados, {skipped} omitidos (ya existian)",
        "created": created,
        "skipped": skipped,
        "total_in_seed": len(seed_data),
    }

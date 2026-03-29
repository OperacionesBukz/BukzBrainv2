"""
Autenticación Firebase para endpoints del backend.
Verifica ID tokens de Firebase Auth enviados desde el frontend.
"""
import os

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import HTTPException, Request

# Inicializar Firebase Admin solo para verificar tokens (no necesita service account)
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "bukzbrain-v2-glow-bright"),
    })


async def verify_firebase_token(request: Request) -> dict:
    """
    Dependencia FastAPI: extrae y verifica el ID token de Firebase
    del header Authorization: Bearer <token>.
    Retorna el token decodificado con uid, email, etc.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Token de autenticación requerido",
        )

    token = auth_header[7:]  # quitar "Bearer "

    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_admin.exceptions.FirebaseError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Error verificando token")

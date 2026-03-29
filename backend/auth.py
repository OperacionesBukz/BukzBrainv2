"""
Autenticación Firebase para endpoints del backend.
Verifica ID tokens de Firebase Auth enviados desde el frontend.
Si firebase-admin no puede inicializarse (falta service account, red, etc.),
se hace fallback a verificación JWT manual con las public keys de Google.
"""
import os
import time
import logging

import requests as http_requests
import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Google public keys para verificar Firebase ID tokens
# ---------------------------------------------------------------------------

_GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cached_certs: dict = {}
_certs_expiry: float = 0

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "bukzbrain-v2-glow-bright")


def _get_google_certs() -> dict:
    """Descarga y cachea las public keys de Google para verificar tokens."""
    global _cached_certs, _certs_expiry

    if _cached_certs and time.time() < _certs_expiry:
        return _cached_certs

    try:
        resp = http_requests.get(_GOOGLE_CERTS_URL, timeout=10)
        resp.raise_for_status()
        _cached_certs = resp.json()
        # Cache por 1 hora (Google rota keys cada ~6 horas)
        _certs_expiry = time.time() + 3600
        return _cached_certs
    except Exception as e:
        logger.warning(f"No se pudieron obtener Google certs: {e}")
        if _cached_certs:
            return _cached_certs
        raise HTTPException(status_code=503, detail="No se puede verificar autenticación")


def _verify_token_manual(token: str) -> dict:
    """Verifica un Firebase ID token usando PyJWT + Google public keys."""
    certs = _get_google_certs()

    # Decodificar header para obtener kid
    try:
        header = jwt.get_unverified_header(token)
    except jwt.exceptions.DecodeError:
        raise HTTPException(status_code=401, detail="Token malformado")

    kid = header.get("kid")
    if not kid or kid not in certs:
        raise HTTPException(status_code=401, detail="Token con kid desconocido")

    cert_pem = certs[kid]

    try:
        decoded = jwt.decode(
            token,
            cert_pem,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
            options={"verify_exp": True},
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Token con audience inválido")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Token con issuer inválido")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")


# ---------------------------------------------------------------------------
# Dependencia FastAPI
# ---------------------------------------------------------------------------

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

    return _verify_token_manual(token)

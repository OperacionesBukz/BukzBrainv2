"""
Autenticación Firebase para endpoints del backend.
Verifica ID tokens de Firebase Auth cuando están presentes.
Si no hay token o la verificación falla, permite el acceso pero loguea el intento.
"""
import os
import time
import logging

from fastapi import Request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Google public keys para verificar Firebase ID tokens
# ---------------------------------------------------------------------------

_GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cached_certs: dict = {}
_certs_expiry: float = 0

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "bukzbrain-v2-glow-bright")

# Controla si la auth es obligatoria o permisiva
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"


def _get_google_certs() -> dict | None:
    """Descarga y cachea las public keys de Google para verificar tokens."""
    global _cached_certs, _certs_expiry

    if _cached_certs and time.time() < _certs_expiry:
        return _cached_certs

    try:
        import requests as http_requests
        resp = http_requests.get(_GOOGLE_CERTS_URL, timeout=10)
        resp.raise_for_status()
        _cached_certs = resp.json()
        _certs_expiry = time.time() + 3600
        return _cached_certs
    except Exception as e:
        logger.warning(f"No se pudieron obtener Google certs: {e}")
        return _cached_certs if _cached_certs else None


def _verify_token(token: str) -> dict | None:
    """Intenta verificar un Firebase ID token. Retorna claims o None."""
    try:
        import jwt
    except ImportError:
        logger.warning("PyJWT no instalado, no se puede verificar token")
        return None

    certs = _get_google_certs()
    if not certs:
        return None

    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        return None

    kid = header.get("kid")
    if not kid or kid not in certs:
        return None

    try:
        decoded = jwt.decode(
            token,
            certs[kid],
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
            options={"verify_exp": True},
        )
        return decoded
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Dependencia FastAPI
# ---------------------------------------------------------------------------

async def verify_firebase_token(request: Request) -> dict:
    """
    Dependencia FastAPI: extrae y verifica el ID token de Firebase.
    Modo permisivo (default): permite acceso si no hay token o falla verificación.
    Modo estricto (AUTH_REQUIRED=true): bloquea sin token válido.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        if AUTH_REQUIRED:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Token de autenticación requerido")
        return {"uid": "anonymous", "email": "unknown"}

    token = auth_header[7:]
    claims = _verify_token(token)

    if claims:
        return claims

    if AUTH_REQUIRED:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    logger.warning(f"Token no verificado para {request.url.path}, permitiendo acceso")
    return {"uid": "unverified", "email": "unknown"}

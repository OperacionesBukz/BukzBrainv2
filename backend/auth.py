"""
Autenticación placeholder — no bloquea requests.
TODO: configurar verificación de tokens cuando se tenga PyJWT instalado en EasyPanel.
"""
from fastapi import Request


async def verify_firebase_token(request: Request) -> dict:
    """No-op: permite todas las requests."""
    return {"uid": "anonymous", "email": "unknown"}

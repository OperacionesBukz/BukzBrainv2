"""
Backend FastAPI para Panel de Operaciones BUKZ.
Expone la lógica de negocio de los módulos Python como API REST.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import ingreso
from routers import scrap
from routers import agent
from routers import cortes
from routers import envio_cortes
from routers import devoluciones
from routers import corte_planeta
from routers import corte_museo

app = FastAPI(
    title="BUKZ Operaciones API",
    description="API backend para el Panel de Operaciones de BUKZ",
    version="1.0.0",
)

# CORS — permite que tu frontend en GitHub Pages se comunique con este backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(ingreso.router)
app.include_router(scrap.router)
app.include_router(agent.router)
app.include_router(cortes.router)
app.include_router(envio_cortes.router)
app.include_router(devoluciones.router)
app.include_router(corte_planeta.router)
app.include_router(corte_museo.router)


@app.get("/health")
def health():
    """Health check general del backend."""
    shopify_ok = settings.validate()
    return {
        "status": "ok",
        "shopify_configured": shopify_ok,
    }


@app.get("/")
def root():
    return {
        "app": "BUKZ Operaciones API",
        "docs": "/docs",
        "health": "/health",
    }

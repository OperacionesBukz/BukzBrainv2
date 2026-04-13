"""
Backend FastAPI para Panel de Operaciones BUKZ.
Expone la lógica de negocio de los módulos Python como API REST.
"""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import verify_firebase_token
from config import settings
from routers import ingreso
from routers import scrap
from routers import agent
from routers import cortes
from routers import envio_cortes
from routers import devoluciones
from routers import corte_planeta
from routers import corte_museo
from routers import gift_cards
from routers import suppliers
from routers import reposiciones
from routers import webhooks
from routers import email
from routers import pedidos
from routers import inventory_turnover
from routers import celesa
from routers import celesa_sync
from routers import agent_commands
from routers import transfers
from routers import conciliacion_ferias
from routers import search
from routers import dead_stock

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: inicializar PostgreSQL y scheduler
    from services.database import init_database
    init_database()
    from services.scheduler_service import start_scheduler
    start_scheduler()
    yield
    # Shutdown: detener scheduler
    from services.scheduler_service import stop_scheduler
    stop_scheduler()


app = FastAPI(
    title="BUKZ Operaciones API",
    description="API backend para el Panel de Operaciones de BUKZ",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite que tu frontend en GitHub Pages se comunique con este backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers — todos protegidos con autenticación Firebase
_auth = [Depends(verify_firebase_token)]
app.include_router(ingreso.router, dependencies=_auth)
app.include_router(scrap.router, dependencies=_auth)
app.include_router(agent.router, dependencies=_auth)
app.include_router(cortes.router, dependencies=_auth)
app.include_router(envio_cortes.router, dependencies=_auth)
app.include_router(devoluciones.router, dependencies=_auth)
app.include_router(corte_planeta.router, dependencies=_auth)
app.include_router(corte_museo.router, dependencies=_auth)
app.include_router(gift_cards.router, dependencies=_auth)
app.include_router(suppliers.router, dependencies=_auth)
app.include_router(reposiciones.router, dependencies=_auth)
app.include_router(email.router, dependencies=_auth)
app.include_router(pedidos.router, dependencies=_auth)
app.include_router(inventory_turnover.router, dependencies=_auth)
app.include_router(celesa.router, dependencies=_auth)
app.include_router(celesa_sync.router, dependencies=_auth)
app.include_router(agent_commands.router, dependencies=_auth)
app.include_router(conciliacion_ferias.router, dependencies=_auth)
app.include_router(search.router, dependencies=_auth)
app.include_router(dead_stock.router, dependencies=_auth)

# Webhooks — SIN auth (Shopify envia su propia verificacion HMAC)
app.include_router(webhooks.router)

# Transfers — SIN auth (lectura solamente, para consulta por agente IA)
app.include_router(transfers.router)


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

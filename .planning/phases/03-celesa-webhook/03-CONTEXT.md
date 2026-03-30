# Phase 3: Webhook Celesa Auto-Entregado - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Cuando un pedido de Shopify se marca como Fulfilled, un webhook actualiza automaticamente los pedidos Celesa con el mismo Order Name a estado "Entregado" en Firestore.

</domain>

<decisions>
## Implementation Decisions

### Webhook Architecture
- **D-01:** Crear router `webhooks.py` en backend (no `celesa.py`) — preparado para futuros webhooks de otros topics
- **D-02:** Endpoint: `POST /api/webhooks/shopify/orders-fulfilled`
- **D-03:** Verificacion HMAC obligatoria con `X-Shopify-Hmac-Sha256` header
- **D-04:** El router NO lleva dependency de `verify_firebase_token` (Shopify no envia Firebase tokens)
- **D-05:** Nueva env var: `SHOPIFY_WEBHOOK_SECRET` (se configura en EasyPanel)

### Matching Logic
- **D-06:** Match por `order_name` del payload Shopify (ej: "#192197") contra `numeroPedido` en Firestore `celesa_orders`
- **D-07:** El `numeroPedido` ya incluye el prefijo "#" — match directo sin transformacion
- **D-08:** Si no hay match en celesa_orders, responder 200 OK silenciosamente (no todos los pedidos son de Celesa)
- **D-09:** Solo actualizar pedidos que NO esten en estado "Entregado" o "Agotado" (evitar sobrescribir estados finales)

### Firestore Update
- **D-10:** Actualizar campo `estado` a "Entregado" y `updatedAt` a server timestamp
- **D-11:** El frontend ya tiene onSnapshot en celesa_orders — el cambio se refleja en tiempo real sin cambios frontend

### Claude's Discretion
- Logging level y formato de logs del webhook
- Estructura interna del router (helpers, etc.)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/firebase_service.py`: `get_firestore_db()` ya inicializa Firebase Admin SDK
- `config.py`: Patron establecido para env vars con `os.getenv()`
- `main.py`: Patron de registro de routers con/sin auth dependency

### Established Patterns
- Routers en `backend/routers/` con `APIRouter(prefix=..., tags=[...])`
- Firestore queries: `db.collection("x").where(...).stream()`
- Health check endpoint en cada router
- Pydantic models para request/response

### Integration Points
- `main.py`: Registrar nuevo router SIN `_auth` dependency
- `config.py`: Agregar `SHOPIFY_WEBHOOK_SECRET`
- EasyPanel: Configurar nueva env var
- Shopify Admin: Registrar webhook URL para topic `orders/fulfilled`

</code_context>

<specifics>
## Specific Ideas

- El Order Name de Shopify y el N Pedido de Celesa representan el mismo numero (confirmado por usuario)
- Formato consistente: ambos usan "#XXXXXX"
- Un pedido Shopify fulfilled puede matchear multiples celesa_orders (un pedido puede tener varios libros)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-celesa-webhook*
*Context gathered: 2026-03-30*

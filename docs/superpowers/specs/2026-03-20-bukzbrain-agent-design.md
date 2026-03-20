# BukzBrain Agent - Spec de Diseno

## Resumen

Agente AI integrado en BukzBrainv2 que permite al usuario interactuar con la app mediante lenguaje natural. Puede responder preguntas sobre los modulos y ejecutar acciones (crear tareas, consultar pedidos, etc.) directamente sobre Firestore.

## Restricciones

- 100% gratuito (sin costos de infraestructura)
- Solo accesible para admins (`isAdmin` de AuthContext) inicialmente
- API keys en variables de entorno (.env), no se commitean
- UI en espanol
- Soporte dark/light mode

## Arquitectura

### Enfoque: Cliente directo

El frontend llama directamente a las APIs de los proveedores LLM. Las tools ejecutan operaciones Firestore desde el cliente, igual que el resto de la app. No hay backend adicional.

```
Chat UI --> AgentContext --> LLM Router --> Tool System --> Firestore
```

### LLM Router (fallback automatico)

Orden de prioridad:

1. **Google Gemini Flash** (primario) - 15 RPM free tier
2. **Groq** (Llama 3) - rate-limited free tier, API compatible con OpenAI
3. **OpenRouter** (modelo open-source gratuito)
4. Mensaje de error si todos fallan: "Los modelos estan ocupados, intenta en unos minutos" con boton de reintentar

Configuracion:
- Variables de entorno: `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`, `VITE_OPENROUTER_API_KEY`
- Timeout por proveedor: 10 segundos
- Cada proveedor tiene un adaptador que normaliza la respuesta a un formato comun: `{ message: string, toolCalls: ToolCall[] }`
- Respuestas en streaming (token por token) para mejor UX

#### Compatibilidad de function calling por proveedor

| Proveedor | Function calling | Formato | Fallback |
|-----------|-----------------|---------|----------|
| Gemini | Nativo | `functionDeclarations` / `functionCall` parts | N/A (primario) |
| Groq | Nativo (formato OpenAI) | `tools` array con tipo `function` | N/A |
| OpenRouter | Depende del modelo | Formato OpenAI si soportado | Prompt-based: se pide al LLM responder en JSON estructurado y se parsea |

Para modelos sin function calling nativo, el system prompt incluye las tools como texto y se le pide responder con un JSON `{ "tool": "nombre", "params": {} }` cuando quiera ejecutar una accion.

#### System prompt (estructura)

```
Eres BukzBrain Assistant, el asistente interno de Bukz.
Responde siempre en espanol.
Usuario actual: {nombre} ({email}), rol: {rol}
Pagina actual: {modulo}

Tienes acceso a las siguientes herramientas:
{lista de tools con descripcion y parametros}

Cuando necesites ejecutar una accion, usa las herramientas disponibles.
Si no puedes hacer algo, explicalo claramente.
Se conciso y directo en tus respuestas.
```

### Tool System

Cada tool es una funcion TypeScript que recibe parametros del LLM y ejecuta operaciones Firestore. Se auto-describe con un schema JSON para el function calling del LLM.

#### Tools por modulo

**Tareas personales** (coleccion: `user_tasks`)
- `createPersonalTask` - Crear tarea personal (titulo, prioridad, fechas)
- `listPersonalTasks` - Listar tareas personales por estado
- `updatePersonalTask` - Cambiar estado, prioridad o titulo
- `assignTask` - Asignar tarea a otro usuario

**Tareas de operaciones** (coleccion: `tasks`)
- `createOperationsTask` - Crear tarea en el kanban de operaciones
- `listOperationsTasks` - Listar tareas de operaciones por estado

**Solicitudes** (coleccion: `leave_requests`)
- `createLeaveRequest` - Crear solicitud (permiso, vacaciones, etc.)
- `listLeaveRequests` - Ver solicitudes pendientes/aprobadas
- `updateLeaveRequestStatus` - Aprobar/rechazar solicitud

**Operaciones / Celesa** (coleccion: `celesa_orders`)
- `queryCelesaOrders` - Consultar pedidos por estado, fecha, proveedor
- `getCelesaStats` - Obtener KPIs (pendientes, en transito, completados)

**Productos** (coleccion: `products`)
- `searchProducts` - Buscar por nombre, ISBN, categoria
- `getProductInventory` - Consultar inventario

**Bookstore** (coleccion: `bookstore_requests`)
- `listBookstoreRequests` - Ver solicitudes de librerias
- `updateBookstoreRequest` - Cambiar estado de solicitud

**Dashboard**
- `getDashboardSummary` - Resumen general (tareas, solicitudes, pedidos)

#### Manejo de errores en tools

Cuando una tool falla (error de Firestore, datos invalidos, permisos):
1. La tool captura el error y retorna `{ success: false, error: "descripcion del error" }`
2. Este resultado se envia de vuelta al LLM
3. El LLM genera un mensaje amigable para el usuario (ej: "No pude crear la tarea porque falta el titulo")
4. No hay reintentos automaticos de tools -- el usuario decide si intenta de nuevo

### Estructura de archivos

```
src/lib/agent/
  tools/
    tasks.ts          - Tools para user_tasks y tasks
    requests.ts       - Tools para leave_requests
    celesa.ts         - Tools para celesa_orders
    products.ts       - Tools para products
    bookstore.ts      - Tools para bookstore_requests
    dashboard.ts      - Tool de resumen general
  tool-registry.ts    - Registra todas las tools con su schema
  llm-router.ts       - Manejo de proveedores con fallback y streaming
  providers/
    gemini.ts         - Adaptador Gemini
    groq.ts           - Adaptador Groq (formato OpenAI)
    openrouter.ts     - Adaptador OpenRouter
  agent-context.tsx   - React Context (conversacion, pagina actual)
  types.ts            - Tipos compartidos
```

## Chat UI

### Boton flotante

- Burbuja en esquina inferior derecha, visible en todas las paginas (solo si `isAdmin`)
- Icono de chat con color primario `#FFED4E`
- Click abre panel de chat: drawer desde abajo (mobile) o panel lateral (desktop)
- Soporte dark/light mode

### Panel de chat (flotante)

- Header: "BukzBrain Assistant" + boton cerrar + boton abrir en pagina completa
- Area de mensajes con scroll, burbujas diferenciadas (usuario vs agente)
- Streaming de respuesta token por token
- Chips de ejecucion de tools: "Creando tarea..." -> "Tarea creada"
- Input de texto + boton enviar, Enter para enviar

### Pagina `/assistant`

- Misma funcionalidad que el panel pero a pantalla completa
- Sidebar izquierdo con historial de conversaciones
- Posibilidad de nueva conversacion o retomar anterior
- Ruta registrada en App.tsx y en `navigation_permissions`

## Modelo de datos (Firestore)

### Coleccion `agent_conversations`

```
agent_conversations/
  {conversationId}/
    userId: string
    title: string              // primeros 50 caracteres del primer mensaje del usuario
    createdAt: timestamp
    updatedAt: timestamp
    messages/                  // sub-coleccion
      {messageId}/
        role: "user" | "assistant"
        content: string
        toolCalls: [           // opcional, si el agente ejecuto tools
          {
            name: string,
            params: object,
            result: object
          }
        ]
        timestamp: timestamp
```

## Gestion de conversacion y tokens

- Se envian al LLM un maximo de **30 mensajes** recientes de la conversacion
- Si la conversacion supera los 30 mensajes, se truncan los mas antiguos (se mantiene siempre el system prompt + los ultimos 30)
- El historial completo permanece en Firestore para consulta, pero solo los recientes se envian al LLM
- Cada modelo tiene su limite de contexto: Gemini Flash (1M), Groq Llama 3 (8K-32K), OpenRouter (variable). El router selecciona la cantidad de mensajes segun el modelo activo

## Seguridad y permisos

### Acceso al agente
- Gate de acceso: `isAdmin` de `AuthContext` (usa el campo `role` de la coleccion `users`)
- Migracion futura a `navigation_permissions` cuando se abra a mas usuarios

### API keys en el frontend (riesgo aceptado)
Las keys `VITE_*` se embeben en el bundle JS de produccion. Cualquier persona con acceso al sitio podria extraerlas via DevTools. Se acepta este riesgo porque:
- Solo users autenticados acceden a la app
- Las keys son de tiers gratuitos, faciles de regenerar
- Se recomienda restringir la Gemini API key por HTTP referrer en Google Cloud Console
- Monitorear uso en los dashboards de cada proveedor
- Plan de migracion: cuando se abra a mas usuarios, mover a Firebase Cloud Functions o Cloudflare Workers

### Permisos de datos
- Las tools operan con los mismos permisos Firestore que el usuario logueado (no hay escalacion de privilegios)

### Rate limiting
- Maximo 20 mensajes por minuto, trackeado en memoria (ref de React)
- Si se excede, el input se deshabilita y muestra "Espera unos segundos antes de enviar otro mensaje"
- Se resetea con el paso del tiempo (sliding window), no con refresh de pagina

## Contexto de pagina

El `AgentContext` escucha `useLocation()` de React Router y mapea la ruta a un nombre de modulo:

| Ruta | Modulo | Tools disponibles |
|------|--------|-------------------|
| `/dashboard` | Dashboard | getDashboardSummary, todas las de lectura |
| `/tasks` | Tareas Personales | createPersonalTask, listPersonalTasks, updatePersonalTask, assignTask |
| `/operations` | Operaciones | createOperationsTask, listOperationsTasks, queryCelesaOrders, getCelesaStats |
| `/celesa` | Celesa (sub-modulo de Operaciones) | queryCelesaOrders, getCelesaStats |
| `/requests` | Solicitudes | createLeaveRequest, listLeaveRequests, updateLeaveRequestStatus |
| `/bookstore-requests` | Solicitudes Librerias | listBookstoreRequests, updateBookstoreRequest |
| `/requests-hub` | Hub de Solicitudes | listLeaveRequests, listBookstoreRequests |
| `/reposicion` | Reposicion | searchProducts (solo lectura) |
| `/ingreso` | Ingreso Mercancia | searchProducts, getProductInventory |
| `/scrap` | Scrap Bukz | searchProducts (solo lectura) |
| `/calculator` | Calculadora | (solo contexto informativo) |
| `/instructions` | Instrucciones | (solo contexto informativo) |
| `/nav-admin` | Admin Navegacion | (solo contexto informativo) |
| `/user-admin` | Admin Usuarios | (solo contexto informativo) |
| `/assistant` | Asistente | todas las tools |

Nota: Todas las tools estan disponibles siempre (el usuario puede pedir acciones de otro modulo). El contexto de pagina solo ayuda al LLM a priorizar e inferir intenciones.

## Dependencias nuevas

Ninguna libreria nueva requerida. Las llamadas a los LLMs se hacen con `fetch` nativo. La UI se construye con los componentes shadcn/ui existentes.

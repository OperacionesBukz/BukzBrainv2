# Phase 6: Wizard Frontend — Config y Sugeridos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 06-wizard-frontend-config-y-sugeridos
**Areas discussed:** Wizard Flow, Sales Cache Handling, Tabla de Sugeridos, Persistencia de Config
**Mode:** --auto (all decisions auto-selected)

---

## Wizard Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page con secciones | Config arriba, resultados abajo. Consistente con patrón existente. | ✓ |
| Stepper lineal | Paso 1: Config → Paso 2: Resultados. Más guiado pero más clicks. | |
| Tabs | Config y Resultados en tabs separados. Pierde contexto visual. | |

**User's choice:** Single-page con secciones (auto-selected: recommended default)
**Notes:** El módulo existente ConfigurationPanel.tsx usa single-page. Mantener consistencia con patrones del proyecto.

---

## Sales Cache Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Flujo automático | Trigger refresh + polling + calcular al completar. Transparente para usuario. | ✓ |
| Manual con botón | Usuario decide cuándo refrescar cache. Más control, más fricción. | |
| Skip si no hay cache | Solo calcular con datos disponibles, advertir si stale. | |

**User's choice:** Flujo automático (auto-selected: recommended default)
**Notes:** El usuario no debería gestionar el cache manualmente. Si no existe o es stale (>24h), el sistema lanza refresh automáticamente, muestra progreso, y calcula al completar.

---

## Tabla de Sugeridos

| Option | Description | Selected |
|--------|-------------|----------|
| Inline edit directo | Click en celda de cantidad → input editable. Enter/blur confirma. | ✓ |
| Modal de edición | Click en fila → modal con todos los campos editables. | |
| Columna de input | Columna siempre visible con inputs de cantidad. | |

**User's choice:** Inline edit directo en celda (auto-selected: recommended default)
**Notes:** Patrón más natural para tablas de datos. ProductDetailTable existente tiene referencia para implementación similar.

---

## Persistencia de Config

| Option | Description | Selected |
|--------|-------------|----------|
| Firestore por user UID | Collection replenishment_config, doc por usuario. Persiste entre dispositivos. | ✓ |
| localStorage | Solo persiste en el mismo navegador/dispositivo. | |
| Sin persistencia | Siempre defaults. Simple pero pierde CONF-05. | |

**User's choice:** Firestore por user UID (auto-selected: recommended default)
**Notes:** CONF-05 requiere persistir config. Firestore es consistente con el stack y persiste entre dispositivos y sesiones.

---

## Claude's Discretion

- Estructura interna de componentes (cuántos archivos, cómo dividir)
- Diseño exacto de la tabla (shadcn Table vs custom)
- Animaciones y transiciones entre estados
- Estado local vs React Query cache para overrides
- Estilo de badges de urgencia y clasificación (colores exactos)

## Deferred Ideas

None — discussion stayed within phase scope

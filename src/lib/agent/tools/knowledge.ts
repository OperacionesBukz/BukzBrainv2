// src/lib/agent/tools/knowledge.ts
// Base de conocimiento interna de Bukz.
// El agente consulta esta tool para responder preguntas sobre procesos.

import type { ToolDefinition } from "../types";

const KNOWLEDGE_BASE: Record<string, { title: string; content: string }> = {
  devoluciones: {
    title: "Proceso de Devoluciones",
    content: `## Proceso de Devoluciones a Proveedores

**Pasos:**
1. Ir a la página de Devoluciones en el menú lateral
2. Seleccionar la sede donde están los libros a devolver
3. Seleccionar el proveedor al que se devuelve
4. Subir un Excel con las columnas: ISBN, Título, Cantidad
5. El sistema envía automáticamente dos correos:
   - A la sede: para preparar los libros para recogida
   - Al proveedor: notificando la devolución con el listado
6. El registro queda en el historial de devoluciones

**Notas importantes:**
- Verificar que los libros estén en buen estado antes de devolver
- Las devoluciones se coordinan por ciudad/sede
- Algunos proveedores tienen ventanas específicas de devolución
- Revisar el acuerdo comercial del proveedor para plazos`,
  },

  pedidos: {
    title: "Proceso de Pedidos a Proveedores",
    content: `## Proceso de Pedidos a Proveedores

**Pasos:**
1. Ir a la página de Pedidos en el menú lateral
2. Seleccionar proveedor, ciudad y tipo de producto
3. Subir Excel con los productos a pedir (ISBN, Título, Cantidad)
4. Revisar el resumen del pedido
5. El sistema envía el correo al proveedor con el archivo adjunto
6. El pedido queda registrado en el log de pedidos

**Pedidos por Reposición (automático):**
1. Ir a Reposiciones
2. Seleccionar sede y proveedor
3. El sistema calcula sugerencias basadas en ventas y stock
4. Aprobar las sugerencias
5. Generar y exportar las órdenes`,
  },

  reposicion: {
    title: "Sistema de Reposición",
    content: `## Sistema de Reposición Inteligente

**Cómo funciona:**
1. El sistema analiza ventas de los últimos 6 meses
2. Compara con stock actual en cada sede
3. Clasifica productos: Bestseller, Regular, Slow, Long Tail
4. Calcula urgencia: URGENTE, PRONTO, NORMAL, OK
5. Genera sugerencias de cantidad a reponer

**Métricas clave:**
- Velocidad de venta: unidades vendidas por mes
- Días de inventario: stock actual / velocidad de venta
- Factor de seguridad: multiplicador configurable (default 1.5x)
- Lead time: tiempo de entrega del proveedor (default 14 días)

**Flujo completo:**
1. Refrescar datos de ventas (Bulk Operation de Shopify)
2. Refrescar inventario por sede
3. Configurar parámetros (lead time, safety factor)
4. Seleccionar vendors y sede
5. Ejecutar cálculo
6. Revisar y aprobar sugerencias
7. Generar órdenes
8. Exportar o enviar por email`,
  },

  cortes: {
    title: "Proceso de Cortes y Conciliación",
    content: `## Proceso de Cortes (Conciliación con Proveedores)

**¿Qué es un corte?**
Un corte es la conciliación de ventas de productos en consignación. Se envía al proveedor el detalle de lo vendido para que facture.

**Tipos de corte:**
- Corte general: para la mayoría de proveedores
- Corte Planeta: formato específico para Grupo Planeta
- Corte Museo: formato específico para la sede Museo

**Pasos:**
1. Ir a Cortes en el menú lateral
2. Subir el archivo con los datos del corte
3. El sistema procesa y genera el reporte
4. Revisar el resultado
5. Enviar al proveedor vía Envío de Cortes

**Envío de Cortes:**
1. Ir a Envío de Cortes
2. Seleccionar proveedor
3. Subir archivos de ventas y no-ventas
4. El sistema envía el correo con los archivos adjuntos`,
  },

  celesa: {
    title: "Dropshipping Celesa/Azeta",
    content: `## Dropshipping con Celesa (España)

**¿Qué es?**
Celesa/Azeta es nuestro proveedor de dropshipping para libros importados de España. Los libros se envían directamente desde España al cliente.

**Flujo de actualización:**
1. Exportar productos de Shopify (CSV)
2. Ir a Celesa Actualización
3. Subir el CSV
4. El sistema consulta stock actual en Azeta
5. Genera archivo con diferencias (productos que cambiaron disponibilidad)
6. Descargar el archivo de Matrixify para actualizar Shopify

**Monitoreo:**
- La página de Celesa muestra pedidos y su estado
- Estados: Pendiente, En curso, Entregado, Agotado, Atrasado`,
  },

  ingreso: {
    title: "Ingreso de Mercancía",
    content: `## Ingreso de Mercancía

**Para buscar productos:**
1. Ir a Ingreso de Mercancía
2. Subir Excel con ISBNs o buscar individualmente
3. El sistema muestra: título, vendor, precio, categoría
4. Se puede ver inventario por bodega

**Para consultar inventario multi-bodega:**
1. Seleccionar las sedes/bodegas
2. Subir Excel con ISBNs
3. El sistema muestra stock en cada sede seleccionada

**Para crear productos nuevos:**
1. Ir a Crear Productos
2. Usar la plantilla de 18 columnas
3. Llenar datos: SKU, Título, Vendor, Precio, etc.
4. Subir y el sistema genera el formato Shopify
5. Se puede crear directamente en Shopify o descargar Excel`,
  },

  scrap: {
    title: "Scrap Bukz (Enriquecimiento de Metadatos)",
    content: `## Scrap Bukz — Enriquecimiento de Libros

**¿Qué hace?**
Busca metadata de libros por ISBN en 11 fuentes diferentes y consolida la información.

**Fuentes:** Casa del Libro, Panamericana, Lerner, Tornamesa, Exlibris, Google Books, HarperCollins, Penguin Random House, Open Library, VTEX retailers, WebLib.

**Flujo:**
1. Subir Excel con columna ISBN
2. El sistema busca en todas las fuentes en paralelo
3. Descarga resultado enriquecido: título, autor, editorial, sinopsis, portada, páginas, idioma, formato
4. Opción de formato "Creación" para crear productos en Shopify directamente`,
  },

  gift_cards: {
    title: "Gift Cards (Tarjetas de Regalo)",
    content: `## Gestión de Gift Cards

**Crear Gift Card:**
1. Ir a Gift Cards
2. Indicar monto y cantidad
3. El sistema crea las gift cards en Shopify
4. Se generan los códigos automáticamente

**Consultar Gift Cards:**
- Ver listado de gift cards activas
- Verificar saldo restante
- Ver historial de uso`,
  },

  roles: {
    title: "Roles y Permisos",
    content: `## Roles del Sistema

**Admin:**
- Acceso completo a todas las páginas
- Puede gestionar usuarios y permisos
- Puede ejecutar operaciones críticas (cortes, devoluciones)
- Puede ver datos de todos los usuarios

**Usuario regular:**
- Acceso según permisos de navegación configurados
- Puede ver sus propias tareas
- Puede crear solicitudes
- No puede modificar permisos ni usuarios

**Permisos de navegación:**
- Se configuran en Admin > Usuarios
- Cada página se puede habilitar/deshabilitar por usuario
- Los cambios aplican inmediatamente`,
  },

  sedes: {
    title: "Sedes y Ubicaciones",
    content: `## Sedes de Bukz

Las sedes se sincronizan automáticamente desde Shopify (Locations).
Cada sede tiene su propio inventario independiente.

**Operaciones por sede:**
- Inventario: stock independiente por sede
- Ventas: reportes segmentados por sede
- Reposición: sugerencias por sede
- Devoluciones: se coordinan por sede
- Pedidos: se envían desde la ciudad de la sede`,
  },
};

const TOPIC_ALIASES: Record<string, string> = {
  devolucion: "devoluciones",
  devolver: "devoluciones",
  returns: "devoluciones",
  pedido: "pedidos",
  orden: "pedidos",
  order: "pedidos",
  reponer: "reposicion",
  reposiciones: "reposicion",
  replenishment: "reposicion",
  corte: "cortes",
  conciliacion: "cortes",
  conciliar: "cortes",
  dropshipping: "celesa",
  azeta: "celesa",
  espana: "celesa",
  ingreso: "ingreso",
  mercancia: "ingreso",
  buscar: "ingreso",
  inventario: "ingreso",
  scrap: "scrap",
  scraping: "scrap",
  enriquecer: "scrap",
  metadata: "scrap",
  gift: "gift_cards",
  tarjeta: "gift_cards",
  regalo: "gift_cards",
  rol: "roles",
  permiso: "roles",
  usuario: "roles",
  admin: "roles",
  sede: "sedes",
  ubicacion: "sedes",
  bodega: "sedes",
  location: "sedes",
};

export const knowledgeTools: ToolDefinition[] = [
  {
    name: "getProcessKnowledge",
    description:
      "Consulta la base de conocimiento interna de Bukz. Devuelve información detallada sobre un proceso o tema específico. Temas disponibles: devoluciones, pedidos, reposicion, cortes, celesa, ingreso, scrap, gift_cards, roles, sedes. Usa esto cuando el usuario pregunte CÓMO hacer algo o pida explicación de un proceso.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Tema a consultar. Ej: 'devoluciones', 'pedidos', 'reposicion', 'cortes', 'celesa', 'ingreso', 'scrap', 'gift_cards', 'roles', 'sedes'",
        },
      },
      required: ["topic"],
    },
    execute: async (params) => {
      try {
        const rawTopic = (params.topic as string).toLowerCase().trim();
        const topic = TOPIC_ALIASES[rawTopic] ?? rawTopic;
        const entry = KNOWLEDGE_BASE[topic];

        if (!entry) {
          const available = Object.keys(KNOWLEDGE_BASE).join(", ");
          return {
            success: true,
            data: {
              found: false,
              message: `No encontré información sobre "${rawTopic}". Temas disponibles: ${available}`,
            },
          };
        }

        return {
          success: true,
          data: {
            found: true,
            topic,
            title: entry.title,
            content: entry.content,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },

  {
    name: "listKnowledgeTopics",
    description:
      "Lista todos los temas disponibles en la base de conocimiento. Usa esto cuando el usuario pregunte qué procesos existen o quiera una visión general.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        const topics = Object.entries(KNOWLEDGE_BASE).map(([key, val]) => ({
          id: key,
          title: val.title,
        }));
        return { success: true, data: { topics, count: topics.length } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  },
];

// src/lib/agent/command-handlers.ts
// Ejecutores de slash commands. Cada handler retorna markdown formateado.

import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resilientFetch } from "@/lib/resilient-fetch";
import { SLASH_COMMANDS } from "./slash-commands";

const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

/** Sanitize text for use inside markdown table cells (escape pipe chars). */
function sanitizeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

export interface CommandResult {
  content: string; // markdown
  type: "success" | "error" | "info";
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await resilientFetch(`${API_BASE}${path}`, { timeout: 30_000 });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// /stock [ISBN]
// ---------------------------------------------------------------------------

async function handleStock(args: string): Promise<CommandResult> {
  if (!args) return { content: "Uso: `/stock [ISBN]` — Ingresa un ISBN o SKU.", type: "error" };

  const data = await apiGet<{
    isbn: string; title: string; vendor: string;
    stock_total: number; stock_by_location: Record<string, number>;
    sales_total: number; sales_by_month: Record<string, number>;
  }>(`/api/commands/stock/${encodeURIComponent(args)}`);

  const lines: string[] = [
    `## ${data.title}`,
    `**Vendor:** ${data.vendor} | **SKU:** ${data.isbn}`,
    "",
    `### Stock Total: ${data.stock_total} uds`,
  ];

  const locs = Object.entries(data.stock_by_location);
  if (locs.length > 0) {
    lines.push("| Sede | Stock |");
    lines.push("|------|------:|");
    for (const [loc, qty] of locs.sort((a, b) => b[1] - a[1])) {
      const indicator = qty === 0 ? " \u{1F534}" : qty <= 3 ? " \u{1F7E1}" : "";
      lines.push(`| ${sanitizeCell(loc)} | ${qty}${indicator} |`);
    }
  }

  if (data.sales_total > 0) {
    lines.push("", `### Ventas: ${data.sales_total} uds (ultimos 6 meses)`);
    const months = Object.entries(data.sales_by_month).sort((a, b) => b[0].localeCompare(a[0]));
    if (months.length > 0) {
      lines.push("| Mes | Uds |");
      lines.push("|-----|----:|");
      for (const [m, u] of months) {
        lines.push(`| ${m} | ${u} |`);
      }
    }
  } else {
    lines.push("", "*Sin ventas registradas en los ultimos 6 meses.*");
  }

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /ventas [ISBN]
// ---------------------------------------------------------------------------

async function handleVentas(args: string): Promise<CommandResult> {
  if (!args) return { content: "Uso: `/ventas [ISBN]` — Ingresa un ISBN o SKU.", type: "error" };

  const data = await apiGet<{
    isbn: string; title: string; vendor: string;
    total_units: number; months: { month: string; units: number }[];
  }>(`/api/commands/ventas/${encodeURIComponent(args)}`);

  const lines: string[] = [
    `## ${data.title}`,
    `**Vendor:** ${data.vendor} | **SKU:** ${data.isbn}`,
    `**Total vendido:** ${data.total_units} unidades`,
    "",
    "| Mes | Unidades |",
    "|-----|--------:|",
  ];

  for (const { month, units } of data.months) {
    const bar = "\u2588".repeat(Math.min(Math.ceil(units / 2), 20));
    lines.push(`| ${month} | ${units} ${bar} |`);
  }

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /top [sede] [mes]
// ---------------------------------------------------------------------------

async function handleTop(args: string): Promise<CommandResult> {
  const parts = args.split(/\s+/).filter(Boolean);
  const params = new URLSearchParams();
  params.set("limit", "20");

  // Intentar parsear args: puede ser "/top", "/top unicentro", "/top unicentro marzo"
  if (parts.length >= 1) params.set("sede", parts[0]);
  if (parts.length >= 2) params.set("mes", parts.slice(1).join(" "));

  const data = await apiGet<{
    sede: string | null; mes: string;
    total_results: number;
    items: { sku: string; title: string; vendor: string; units: number }[];
  }>(`/api/commands/top?${params.toString()}`);

  const headerParts = ["## Top Ventas"];
  if (data.sede) headerParts.push(`en ${data.sede}`);
  if (data.mes !== "todos") headerParts.push(`(${data.mes})`);

  const lines: string[] = [
    headerParts.join(" "),
    `*${data.total_results} productos*`,
    "",
    "| # | Titulo | Vendor | Uds |",
    "|--:|--------|--------|----:|",
  ];

  data.items.forEach((item, i) => {
    const title = item.title.length > 35 ? item.title.slice(0, 35) + "..." : item.title;
    lines.push(`| ${i + 1} | ${sanitizeCell(title)} | ${sanitizeCell(item.vendor)} | ${item.units} |`);
  });

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /agotados [sede]
// ---------------------------------------------------------------------------

async function handleAgotados(args: string): Promise<CommandResult> {
  if (!args) return { content: "Uso: `/agotados [sede]` — Ingresa el nombre de la sede.", type: "error" };

  const data = await apiGet<{
    sede: string; total_agotados: number; total_productos: number; porcentaje: number;
    items: { sku: string; title: string; vendor: string; available: number }[];
  }>(`/api/commands/agotados?sede=${encodeURIComponent(args)}`);

  const lines: string[] = [
    `## Agotados en ${data.sede}`,
    `**${data.total_agotados}** de ${data.total_productos} productos (${data.porcentaje}%)`,
    "",
  ];

  if (data.items.length > 0) {
    lines.push("| SKU | Titulo | Vendor |");
    lines.push("|-----|--------|--------|");
    for (const item of data.items.slice(0, 30)) {
      const title = item.title.length > 30 ? item.title.slice(0, 30) + "..." : item.title;
      lines.push(`| ${item.sku} | ${sanitizeCell(title)} | ${sanitizeCell(item.vendor)} |`);
    }
    if (data.items.length > 30) {
      lines.push(``, `*... y ${data.items.length - 30} mas*`);
    }
  } else {
    lines.push("*No hay productos agotados. Todo en stock.*");
  }

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /buscar [ISBN] — Busca en Shopify (endpoint existente)
// ---------------------------------------------------------------------------

async function handleBuscar(args: string): Promise<CommandResult> {
  if (!args) return { content: "Uso: `/buscar [ISBN]` — Ingresa un ISBN o SKU.", type: "error" };

  const data = await apiGet<{
    product: Record<string, unknown>;
  }>(`/api/ingreso/search/${encodeURIComponent(args)}`);

  const p = data.product;
  const lines: string[] = [
    `## ${p["Titulo"] ?? p["Title"] ?? "—"}`,
    `**SKU:** ${p["ISBN"] ?? p["SKU"] ?? "—"}`,
    `**Vendor:** ${p["Vendor"] ?? "—"}`,
    `**Precio:** $${p["Precio"] ?? p["Price"] ?? "—"}`,
    `**Categoria:** ${p["Categoria"] ?? p["Type"] ?? "—"}`,
  ];

  if (p["ID"]) lines.push(`**Product ID:** ${p["ID"]}`);
  if (p["Variant ID"]) lines.push(`**Variant ID:** ${p["Variant ID"]}`);

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /tareas — Tareas personales pendientes (Firestore directo)
// ---------------------------------------------------------------------------

async function handleTareas(_args: string, userId: string): Promise<CommandResult> {
  const q = query(
    collection(db, "user_tasks"),
    where("userId", "==", userId),
    where("status", "==", "todo"),
    firestoreLimit(30),
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { content: "No tienes tareas pendientes.", type: "info" };
  }

  const tasks = snapshot.docs.map((d) => {
    const data = d.data();
    return { title: data.title, priority: data.priority ?? "Media" };
  });

  const priorityOrder: Record<string, number> = { Urgente: 0, Alta: 1, Media: 2, Baja: 3 };
  tasks.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

  const priorityIcon: Record<string, string> = {
    Urgente: "\u{1F534}", Alta: "\u{1F7E0}", Media: "\u{1F7E1}", Baja: "\u{1F7E2}",
  };

  const lines: string[] = [
    `## Tareas Pendientes (${tasks.length})`,
    "",
  ];

  for (const t of tasks) {
    const icon = priorityIcon[t.priority] ?? "";
    lines.push(`- ${icon} **${t.priority}** — ${t.title}`);
  }

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /reposicion [vendor]
// ---------------------------------------------------------------------------

async function handleReposicion(args: string): Promise<CommandResult> {
  if (!args) return { content: "Uso: `/reposicion [vendor]` — Ingresa el nombre del proveedor.", type: "error" };

  return {
    content: [
      `## Reposicion — ${args}`,
      "",
      "Para ver sugerencias de reposicion detalladas, usa la pagina de **Reposiciones** en el menu lateral.",
      "",
      "Desde ahi puedes:",
      "- Seleccionar proveedor y sede",
      "- Ver calculo de sugerencias con urgencia",
      "- Aprobar y generar ordenes",
    ].join("\n"),
    type: "info",
  };
}

// ---------------------------------------------------------------------------
// /celesa
// ---------------------------------------------------------------------------

async function handleCelesa(): Promise<CommandResult> {
  return {
    content: [
      "## Estado Celesa",
      "",
      "Para ver el estado del dropshipping Celesa, usa la pagina de **Celesa** en el menu lateral.",
      "",
      "Desde ahi puedes:",
      "- Subir exportacion de productos",
      "- Ver diferencias de stock con Azeta",
      "- Generar archivos de actualizacion",
    ].join("\n"),
    type: "info",
  };
}

// ---------------------------------------------------------------------------
// /resumen
// ---------------------------------------------------------------------------

async function handleResumen(): Promise<CommandResult> {
  const data = await apiGet<{
    inventario: {
      sedes: number; productos_totales: number; stock_total: number;
      agotados_total: number; por_sede: { sede: string; productos?: number; agotados?: number; stock_total?: number; status?: string }[];
    };
    ventas: { status: string; skus_con_ventas: number; ultimo_refresh: string | null };
    tareas_pendientes: number;
  }>("/api/commands/resumen");

  const inv = data.inventario;
  const lines: string[] = [
    "## Resumen Operativo",
    "",
    "### Inventario",
    `- **${inv.sedes}** sedes activas`,
    `- **${inv.productos_totales.toLocaleString()}** productos totales`,
    `- **${inv.stock_total.toLocaleString()}** unidades en stock`,
    `- **${inv.agotados_total}** productos agotados`,
    "",
  ];

  if (inv.por_sede.length > 0) {
    lines.push("| Sede | Productos | Agotados | Stock |");
    lines.push("|------|--------:|--------:|------:|");
    for (const s of inv.por_sede) {
      if (s.status === "sin_datos") {
        lines.push(`| ${s.sede} | — | — | sin datos |`);
      } else {
        lines.push(`| ${s.sede} | ${s.productos?.toLocaleString()} | ${s.agotados} | ${s.stock_total?.toLocaleString()} |`);
      }
    }
  }

  lines.push(
    "",
    "### Ventas",
    `- Estado: **${data.ventas.status === "ok" ? "Disponible" : "Sin datos"}**`,
    `- ${data.ventas.skus_con_ventas.toLocaleString()} SKUs con ventas`,
  );
  if (data.ventas.ultimo_refresh) {
    lines.push(`- Ultimo refresh: ${data.ventas.ultimo_refresh}`);
  }

  lines.push(
    "",
    `### Tareas Operativas`,
    `- **${data.tareas_pendientes}** tareas pendientes`,
  );

  return { content: lines.join("\n"), type: "success" };
}

// ---------------------------------------------------------------------------
// /ayuda
// ---------------------------------------------------------------------------

function handleAyuda(): CommandResult {
  const lines: string[] = [
    "## Comandos Disponibles",
    "",
    "Escribe `/` para ver el menu de autocompletado.",
    "",
    "| Comando | Descripcion |",
    "|---------|-------------|",
  ];

  for (const cmd of SLASH_COMMANDS) {
    lines.push(`| \`${cmd.usage}\` | ${cmd.description} |`);
  }

  lines.push(
    "",
    "*Los comandos consultan datos locales/cache — 0 tokens de IA.*",
    "*Para preguntas complejas, escribe tu mensaje sin \"/\".*",
  );

  return { content: lines.join("\n"), type: "info" };
}

// ---------------------------------------------------------------------------
// Router principal
// ---------------------------------------------------------------------------

export async function executeCommand(name: string, args: string, userId: string): Promise<CommandResult> {
  try {
    switch (name) {
      case "stock": return await handleStock(args);
      case "ventas": return await handleVentas(args);
      case "top": return await handleTop(args);
      case "agotados": return await handleAgotados(args);
      case "buscar": return await handleBuscar(args);
      case "tareas": return await handleTareas(args, userId);
      case "reposicion": return await handleReposicion(args);
      case "celesa": return await handleCelesa();
      case "resumen": return await handleResumen();
      case "ayuda": return handleAyuda();
      default: return { content: `Comando \`/${name}\` no reconocido. Escribe \`/ayuda\` para ver los comandos disponibles.`, type: "error" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { content: `**Error:** ${message}`, type: "error" };
  }
}

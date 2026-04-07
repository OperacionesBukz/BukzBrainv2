// src/lib/agent/slash-commands.ts
// Registro de slash commands disponibles en el chat del Asistente.
// Los comandos se ejecutan localmente sin usar LLM (0 tokens).

export interface SlashCommandDef {
  name: string;
  description: string;
  usage: string;
  args: string;
  icon: string; // emoji para el menú
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: "stock",
    description: "Consultar stock de un producto por ISBN/SKU",
    usage: "/stock [ISBN]",
    args: "ISBN o SKU del producto",
    icon: "📦",
  },
  {
    name: "ventas",
    description: "Ver historial de ventas de un producto",
    usage: "/ventas [ISBN]",
    args: "ISBN o SKU del producto",
    icon: "📊",
  },
  {
    name: "top",
    description: "Top productos más vendidos",
    usage: "/top [sede] [mes]",
    args: "Nombre de sede (opcional), mes (opcional, ej: marzo)",
    icon: "🏆",
  },
  {
    name: "agotados",
    description: "Productos agotados por sede",
    usage: "/agotados [sede]",
    args: "Nombre de la sede",
    icon: "🚨",
  },
  {
    name: "buscar",
    description: "Buscar metadata de un libro por ISBN (scraping)",
    usage: "/buscar [ISBN]",
    args: "ISBN del libro",
    icon: "🔍",
  },
  {
    name: "tareas",
    description: "Ver tus tareas pendientes",
    usage: "/tareas",
    args: "Sin argumentos",
    icon: "✅",
  },
  {
    name: "reposicion",
    description: "Sugerencias de reposición por proveedor",
    usage: "/reposicion [vendor]",
    args: "Nombre del proveedor",
    icon: "🔄",
  },
  {
    name: "celesa",
    description: "Estado del dropshipping Celesa",
    usage: "/celesa",
    args: "Sin argumentos",
    icon: "🇪🇸",
  },
  {
    name: "resumen",
    description: "Resumen operativo del día",
    usage: "/resumen",
    args: "Sin argumentos",
    icon: "📋",
  },
  {
    name: "ayuda",
    description: "Ver todos los comandos disponibles",
    usage: "/ayuda",
    args: "Sin argumentos",
    icon: "❓",
  },
];

/** Parse input to check if it's a slash command. Returns null if not a command. */
export function parseSlashCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  const name = spaceIdx === -1
    ? trimmed.slice(1).toLowerCase()
    : trimmed.slice(1, spaceIdx).toLowerCase();
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const cmd = SLASH_COMMANDS.find((c) => c.name === name);
  if (!cmd) return null;

  return { name, args };
}

/** Filter commands based on partial input (for autocomplete). */
export function filterCommands(partial: string): SlashCommandDef[] {
  const query = partial.startsWith("/") ? partial.slice(1).toLowerCase() : partial.toLowerCase();
  if (!query) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.name.includes(query) || c.description.toLowerCase().includes(query),
  );
}

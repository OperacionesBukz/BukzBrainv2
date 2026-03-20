import type { ToolDefinition } from "./types";
import { taskTools } from "./tools/tasks";
import { requestTools } from "./tools/requests";
import { celesaTools } from "./tools/celesa";
import { productTools } from "./tools/products";
import { bookstoreTools } from "./tools/bookstore";
import { dashboardTools } from "./tools/dashboard";

export function getAllTools(): ToolDefinition[] {
  return [
    ...taskTools,
    ...requestTools,
    ...celesaTools,
    ...productTools,
    ...bookstoreTools,
    ...dashboardTools,
  ];
}

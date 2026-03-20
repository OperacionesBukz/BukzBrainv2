import type { ToolDefinition } from "./types";
import { taskTools } from "./tools/tasks";
// Uncommented in Task 8:
// import { requestTools } from "./tools/requests";
// import { celesaTools } from "./tools/celesa";
// import { productTools } from "./tools/products";
// import { bookstoreTools } from "./tools/bookstore";
// import { dashboardTools } from "./tools/dashboard";

export function getAllTools(): ToolDefinition[] {
  return [
    ...taskTools,
  ];
}

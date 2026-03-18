export { API_BASE } from "../ingreso/types";

export interface EnrichResponse {
  job_id: string;
  total_isbns: number;
  invalid_isbns: string[];
  valid_count: number;
  isbn_column: string;
}

export interface JobStatus {
  status: "processing" | "completed" | "error";
  processed: number;
  total: number;
  logs: string[];
  error: string | null;
}

export interface CacheStats {
  total_cached: number;
}

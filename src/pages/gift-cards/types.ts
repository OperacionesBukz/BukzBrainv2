export const API_BASE =
  import.meta.env.VITE_API_URL ??
  "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";

export interface GiftCard {
  id: string;
  code: string;
  balance: string;
  currency: string;
  initial_value: string;
  expires_on: string | null;
  enabled: boolean;
  note: string;
  created_at: string;
  customer_email: string;
  customer_name: string;
}

export interface GiftCardCreateRequest {
  initial_value: string;
  note: string;
  customer_email: string;
  expires_months: number;
}

export interface GiftCardSearchRequest {
  query: string;
  limit: number;
}

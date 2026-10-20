export type Role = "operator" | "supervisor" | "administrator";
export type User = {
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type Camera = {
  camera_id: string;
  name: string;
  location: string | null;
  description: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type AuditEvent = {
  event_id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  occurred_at: string;
  details: Record<string, unknown>;
};
export const roleLabels: Record<Role, string> = {
  operator: "Operator",
  supervisor: "Supervisor",
  administrator: "Administrator",
};
export const roleDescriptions: Record<Role, string> = {
  operator: "Browse footage, investigate recordings, view evidence and submit feedback.",
  supervisor: "Operator access, plus evidence export, audit logs and future standing queries.",
  administrator:
    "All features, including user access, cameras, recordings and processing settings.",
};

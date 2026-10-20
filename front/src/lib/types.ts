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
  actor_name: string;
  resource_name: string;
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

export type UploadState = "pending" | "uploading" | "ready" | "failed" | "deleting";
export type Video = {
  schema_version: string;
  producer_version: string;
  video_id: string;
  camera_id: string;
  camera: Camera;
  title: string;
  description: string | null;
  original_filename: string;
  content_type: string;
  expected_byte_size: number;
  byte_size: number | null;
  sha256: string | null;
  upload_state: UploadState;
  metadata_state: "pending" | "ready" | "failed";
  thumbnail_state: "pending" | "ready" | "failed";
  thumbnail_url: string | null;
  recording_start: string;
  recording_end: string | null;
  recording_timezone: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  video_codec: string | null;
  last_error: string | null;
  indexing_status: "not_indexed";
  created_at: string;
  updated_at: string;
};
export type VideoInput = {
  camera_id: string;
  original_filename: string;
  expected_byte_size: number;
  title: string;
  description: string | null;
  recording_start: string;
};
export type UploadPolicy = { max_bytes: number; extensions: string[]; timeout_seconds: number };
export type Playback = {
  url: string;
  thumbnail_url: string | null;
  expires_in: number;
  content_type: string;
  rendition: "original" | "playback";
};
export type PlaybackPreparation = {
  schema_version: string;
  producer_version: string;
  job_id: string | null;
  status: "not_requested" | "queued" | "running" | "succeeded" | "failed";
  stage: string;
  attempts: number;
  last_error: string | null;
  updated_at: string | null;
};
export const uploadStateLabels: Record<UploadState, string> = {
  pending: "Awaiting upload",
  uploading: "Uploading",
  ready: "Stored",
  failed: "Upload failed",
  deleting: "Deletion pending",
};

export type ServiceStatus = {
  backend: { connected: boolean; message: string };
  worker: { connected: boolean; mode: string; message: string };
};

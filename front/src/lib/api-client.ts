import type {
  Camera,
  Page,
  User,
  LoginResponse,
  AuditEvent,
  Video,
  VideoInput,
  UploadPolicy,
  Playback,
  PlaybackPreparation,
  ServiceStatus,
} from "./types";
// Empty means same-origin requests through Next.js, including inside Compose.
const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = true, ...init } = options;
  const headers = new Headers(init.headers);
  const dispatchedToken = authenticated ? accessToken : null;
  if (init.body) headers.set("Content-Type", "application/json");
  if (dispatchedToken) headers.set("Authorization", `Bearer ${dispatchedToken}`);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the backend. Check the connection and try again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const fields: Record<string, string> = {};
    if (Array.isArray(body?.detail)) {
      for (const entry of body.detail) {
        const field = entry.loc?.at(-1);
        if (typeof field === "string") fields[field] = entry.msg ?? "Check this field.";
      }
    }
    const message =
      typeof body?.detail === "string"
        ? body.detail
        : response.status === 422
          ? "Check the highlighted fields and try again."
          : response.status === 403
            ? "Your role does not have access to this action."
            : response.status === 401
              ? "Your sign-in has expired. Sign in again to continue."
              : `The request could not be completed (HTTP ${response.status}).`;
    if (response.status === 401 && dispatchedToken && accessToken === dispatchedToken)
      unauthorizedHandler?.();
    throw new ApiError(response.status, message, fields);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export type CameraInput = {
  name: string;
  location: string | null;
  description: string | null;
  timezone: string;
};
export const api = {
  services: (signal?: AbortSignal) => request<ServiceStatus>("/api/services/status", { signal }),
  uploadPolicy: () => request<UploadPolicy>("/api/videos/upload-policy"),
  videos: (params: URLSearchParams) => request<Page<Video>>(`/api/videos?${params}`),
  video: (id: string) => request<Video>(`/api/videos/${id}`),
  createVideo: (body: VideoInput) =>
    request<Video>("/api/videos", { method: "POST", body: JSON.stringify(body) }),
  updateVideo: (id: string, body: { title: string; description: string | null }) =>
    request<Video>(`/api/videos/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVideo: (id: string) => request<void>(`/api/videos/${id}`, { method: "DELETE" }),
  playback: (id: string) => request<Playback>(`/api/videos/${id}/playback`, { method: "POST" }),
  playbackPreparation: (id: string, signal?: AbortSignal) =>
    request<PlaybackPreparation>(`/api/videos/${id}/playback-preparation`, { signal }),
  preparePlayback: (id: string) =>
    request<PlaybackPreparation>(`/api/videos/${id}/playback-preparation`, { method: "POST" }),
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      authenticated: false,
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
  users: (params: URLSearchParams) => request<Page<User>>(`/api/users?${params}`),
  createUser: (body: { email: string; display_name: string; password: string; role: string }) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { display_name?: string; role?: string; is_active?: boolean }) =>
    request<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  resetPassword: (id: string, password: string) =>
    request<void>(`/api/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  cameras: (params: URLSearchParams) => request<Page<Camera>>(`/api/cameras?${params}`),
  createCamera: (body: CameraInput) =>
    request<Camera>("/api/cameras", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCamera: (id: string, body: Partial<CameraInput> & { is_active?: boolean }) =>
    request<Camera>(`/api/cameras/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  audit: (params: URLSearchParams) => request<Page<AuditEvent>>(`/api/audit-events?${params}`),
};
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
export function errorFields(error: unknown) {
  return error instanceof ApiError ? error.fields : {};
}

/** Stream the raw File, with network progress; no base64, FormData or whole-file arrayBuffer. */
export function uploadVideoContent(
  id: string,
  file: File,
  options: { timeoutSeconds: number; signal: AbortSignal; onProgress: (percent: number) => void },
): Promise<Video> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const dispatchedToken = accessToken;
    const abort = () => xhr.abort();
    const cleanup = () => options.signal.removeEventListener("abort", abort);
    xhr.open("PUT", `${baseUrl}/api/videos/${id}/content`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    if (dispatchedToken) xhr.setRequestHeader("Authorization", `Bearer ${dispatchedToken}`);
    xhr.timeout = (options.timeoutSeconds + 120) * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      cleanup();
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        resolve(body as Video);
        return;
      }
      if (xhr.status === 401 && dispatchedToken && accessToken === dispatchedToken)
        unauthorizedHandler?.();
      reject(
        new ApiError(
          xhr.status,
          typeof body?.detail === "string"
            ? body.detail
            : `Upload could not be completed (HTTP ${xhr.status}). Check the library before retrying.`,
        ),
      );
    };
    xhr.onerror = () => {
      cleanup();
      reject(new ApiError(0, "Upload connection lost. Check the library before retrying."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new ApiError(408, "Upload request timed out. Check the library before retrying."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload request canceled.", "AbortError"));
    };
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) {
      cleanup();
      reject(new DOMException("Upload request canceled.", "AbortError"));
      return;
    }
    xhr.send(file);
  });
}

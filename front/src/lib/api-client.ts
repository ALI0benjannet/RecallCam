const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function checkBackend(): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health/live`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
}

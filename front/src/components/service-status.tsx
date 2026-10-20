"use client";
import { useEffect, useRef, useState } from "react";
import { CircleCheckIcon, CircleXIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import type { ServiceStatus as ServiceStatusData } from "@/lib/types";
export function ServiceStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ServiceStatusData | null>(null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const manual = useRef(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;
    async function check() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      setChecking(true);
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 6000);
      try {
        const result = await api.services(controller.signal);
        if (!active) return;
        setStatus(result);
        if (manual.current) {
          if (result.backend.connected && result.worker.connected)
            toast.success(
              result.worker.mode === "media"
                ? "Backend and playback worker are connected. AI indexing is unavailable."
                : "Backend and worker are connected. Worker is in standby.",
            );
          else toast.error("Backend connected, but the worker is unavailable.");
        }
      } catch (err) {
        if (!active) return;
        setStatus({
          backend: {
            connected: false,
            message: "Backend status unavailable. Check the API connection.",
          },
          worker: {
            connected: false,
            mode: "unknown",
            message: "Worker status cannot be confirmed while the backend is unavailable.",
          },
        });
        if (manual.current) toast.error(errorMessage(err));
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (active) {
          setChecking(false);
          manual.current = false;
        }
      }
    }
    void check();
    const timer = window.setInterval(() => void check(), 20000);
    const refresh = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, revision]);
  return (
    <div className="flex items-center gap-4" aria-label="Service connections">
      <div className="flex flex-wrap items-center gap-4" role="status" aria-live="polite">
        {(["backend", "worker"] as const).map((name) => {
          const service = status?.[name];
          const label = name === "backend" ? "Backend" : "Worker";
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 text-[11px]"
              title={service?.message ?? "Checking connection…"}
            >
              {!service ? (
                <RefreshCw className="size-3.5 text-muted-foreground" />
              ) : service.connected ? (
                <CircleCheckIcon className="size-3.5 text-primary" />
              ) : (
                <CircleXIcon className="size-3.5 text-destructive" />
              )}
              <span className="font-medium">{label}</span>
              <span className="sr-only">
                :{" "}
                {!service
                  ? "Checking"
                  : service.connected
                    ? name === "worker"
                      ? service.message
                      : "Connected"
                    : "Disconnected or unhealthy"}
              </span>
              <span className="hidden text-[10px] text-muted-foreground 2xl:inline">
                {!service
                  ? "Checking"
                  : service.connected
                    ? name === "worker"
                      ? status?.worker.mode === "media"
                        ? "Playback"
                        : "Standby"
                      : "Connected"
                    : "Unavailable"}
              </span>
            </span>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={checking}
        aria-label="Refresh backend and worker connections"
        title="Refresh service connections"
        onClick={() => {
          manual.current = true;
          setRevision((n) => n + 1);
        }}
      >
        <RefreshCw className="size-3" />
      </Button>
    </div>
  );
}

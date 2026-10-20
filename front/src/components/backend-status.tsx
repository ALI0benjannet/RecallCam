"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkBackend, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function BackendStatus() {
  const [status, setStatus] = useState("Connection has not been checked.");
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    try {
      await checkBackend();
      setStatus("The backend process is reachable.");
      toast.success("Backend connection is available.");
    } catch (err) {
      const message = errorMessage(err);
      setStatus(message);
      toast.error(message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="panel p-6" aria-labelledby="backend-heading">
      <h2 id="backend-heading" className="panel-title">
        Backend connection
      </h2>
      <p className="mt-3 text-xs leading-6 text-muted-foreground" role="status">
        {status}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 w-full bg-card"
        onClick={check}
        disabled={checking}
      >
        <RefreshCw className="size-3.5" />
        {checking ? "Checking connection…" : "Check connection"}
      </Button>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Checks the API process, not indexing or model availability.
      </p>
    </section>
  );
}

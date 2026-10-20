"use client";

import { useState } from "react";
import { checkBackend } from "../lib/api-client";

export function BackendStatus() {
  const [status, setStatus] = useState("Not checked");
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      await checkBackend();
      setStatus("Backend process is reachable");
    } catch {
      setStatus("Backend is unreachable. Check its address and startup command.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby="backend-heading">
      <h2 id="backend-heading">Backend connection</h2>
      <p role="status">{status}</p>
      <button type="button" onClick={check} disabled={checking}>
        {checking ? "Checking…" : "Check backend"}
      </button>
    </section>
  );
}

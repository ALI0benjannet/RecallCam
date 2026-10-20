"use client";

import { useEffect, useRef, useState } from "react";
import { FileVideo, LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import type { PlaybackPreparation } from "@/lib/types";

const stageLabels: Record<string, string> = {
  queued: "Waiting for the worker",
  downloading: "Reading the original recording",
  converting: "Converting the playback copy",
  storing: "Saving the private playback copy",
};

export function PlaybackPreparationPanel({
  videoId,
  unsupported,
  canManage,
  usingPreparedCopy,
  opening,
  onOpen,
}: {
  videoId: string;
  unsupported: boolean;
  canManage: boolean;
  usingPreparedCopy: boolean;
  opening: boolean;
  onOpen: () => void;
}) {
  const [status, setStatus] = useState<PlaybackPreparation | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const previous = useRef<PlaybackPreparation["status"] | null>(null);
  const currentVideo = useRef(videoId);
  const mounted = useRef(true);
  currentVideo.current = videoId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function load() {
      if (document.hidden) {
        timer = setTimeout(() => void load(), 3000);
        return;
      }
      try {
        const result = await api.playbackPreparation(videoId, controller.signal);
        if (!active) return;
        const wasActive = previous.current === "queued" || previous.current === "running";
        if (wasActive && result.status === "succeeded")
          toast.success("The MP4 playback copy is ready.");
        if (wasActive && result.status === "failed")
          toast.error(result.last_error || "Playback preparation failed.");
        previous.current = result.status;
        setStatus(result);
        setError("");
        if (result.status === "queued" || result.status === "running")
          timer = setTimeout(() => void load(), 3000);
      } catch (err) {
        if (!active) return;
        setError(errorMessage(err));
        toast.error("Playback preparation status could not be loaded.");
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [videoId, revision]);

  async function prepare() {
    setSubmitting(true);
    setError("");
    const requestedVideo = videoId;
    try {
      const result = await api.preparePlayback(videoId);
      if (!mounted.current || currentVideo.current !== requestedVideo) return;
      setStatus(result);
      previous.current = result.status;
      setRevision((n) => n + 1);
      toast.success(
        result.status === "succeeded"
          ? "A playback copy is already available."
          : "Playback preparation requested. Waiting for the worker.",
      );
    } catch (err) {
      if (!mounted.current || currentVideo.current !== requestedVideo) return;
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      if (mounted.current && currentVideo.current === requestedVideo) setSubmitting(false);
    }
  }

  if (!unsupported && (!status || status.status === "not_requested") && !error) return null;
  const pending = status?.status === "queued" || status?.status === "running";
  const ready = status?.status === "succeeded";
  if (usingPreparedCopy && ready && !unsupported) return null;

  return (
    <div className="border-t bg-muted/40 px-5 py-5" aria-live="polite">
      <div className="flex items-start gap-3">
        {pending ? (
          <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <FileVideo className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            {pending
              ? stageLabels[status?.stage ?? "queued"] || "Preparing playback"
              : ready
                ? "MP4 playback copy available"
                : status?.status === "failed"
                  ? "Playback preparation failed"
                  : "Prepare a browser-compatible copy"}
          </h3>
          <p className="mt-2 max-w-prose text-xs leading-6 text-muted-foreground">
            {pending
              ? "This explicitly requested job creates a playback copy. The original stays stored and AI indexing remains separate."
              : ready
                ? "The browser can use the prepared H.264 MP4 copy. The original recording is preserved."
                : "Create an H.264 MP4 copy for browser playback. This keeps the original and queues conversion only when you select Prepare playback."}
          </p>
          {status?.last_error && (
            <p className="mt-2 text-xs leading-6 text-destructive">{status.last_error}</p>
          )}
          {error && (
            <p className="mt-2 text-xs leading-6 text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {error && (
              <Button size="sm" variant="outline" onClick={() => setRevision((n) => n + 1)}>
                Refresh preparation status
              </Button>
            )}
            {ready && !usingPreparedCopy && (
              <Button size="sm" disabled={opening} onClick={onOpen}>
                <Play className="size-3.5" />
                {opening ? "Opening…" : "Play MP4 copy"}
              </Button>
            )}
            {!ready && !pending && canManage && status && (
              <Button size="sm" disabled={submitting} onClick={() => void prepare()}>
                {submitting
                  ? "Requesting…"
                  : status.status === "failed"
                    ? "Retry preparation"
                    : "Prepare playback"}
              </Button>
            )}
          </div>
          {!canManage && !ready && !pending && (
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              An administrator can request playback preparation for this recording.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

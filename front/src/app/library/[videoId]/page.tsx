"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Camera, FileVideo, Pencil, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PlaybackPreparationPanel } from "@/components/playback-preparation";
import {
  RecordingPlayer,
  type RecordingPlaybackState,
  type RecordingPlayerHandle,
} from "@/components/recording-player";
import {
  FieldError,
  formatDate,
  LoadError,
  LoadingRows,
  notifyError,
  PageHeading,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, errorFields, errorMessage, uploadVideoContent } from "@/lib/api-client";
import { formatBytes, formatDuration, formatRecorded } from "@/lib/media";
import { uploadStateLabels, type Playback, type Video } from "@/lib/types";
function RecordingEditor({
  video,
  onClose,
  onSaved,
}: {
  video: Video;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFields({});
    const form = new FormData(event.currentTarget);
    try {
      await api.updateVideo(video.video_id, {
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim() || null,
      });
      toast.success("Recording details updated.");
      onSaved();
      onClose();
    } catch (err) {
      setFields(errorFields(err));
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Edit recording</DialogTitle>
          <DialogDescription>
            Update its title and description. The original file and recording timeline are
            preserved.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="space-y-5"
          onInvalid={() =>
            toast.error("Check the recording details.", { id: "edit-recording-validation" })
          }
        >
          <div className="form-field">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              name="title"
              defaultValue={video.title}
              required
              maxLength={200}
              disabled={busy}
              aria-invalid={!!fields.title}
            />
            <FieldError message={fields.title} />
          </div>
          <div className="form-field">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              name="description"
              defaultValue={video.description ?? ""}
              maxLength={2000}
              disabled={busy}
            />
            <FieldError message={fields.description} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function RetryUpload({ video, onSaved }: { video: Video; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function retry() {
    if (!file) return;
    if (file.name !== video.original_filename || file.size !== video.expected_byte_size) {
      toast.error("Choose the original file with the same name and size.");
      return;
    }
    setBusy(true);
    setProgress(0);
    controller.current = new AbortController();
    try {
      const policy = await api.uploadPolicy();
      await uploadVideoContent(video.video_id, file, {
        timeoutSeconds: policy.timeout_seconds,
        signal: controller.current.signal,
        onProgress: (value) => {
          if (mounted.current) setProgress(value);
        },
      });
      if (mounted.current) {
        toast.success("Recording stored. No processing was started.");
        onSaved();
      }
    } catch (err) {
      if (mounted.current) {
        if (err instanceof DOMException && err.name === "AbortError")
          toast.info("Request canceled. Refresh to check whether saving finished.");
        else notifyError(err);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="panel p-6">
      <h2 className="panel-title">Complete the upload</h2>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Choose {video.original_filename} ({formatBytes(video.expected_byte_size)}) to send the
        original bytes again. An active upload must finish or expire before a retry is accepted. To
        discard an interrupted upload immediately, delete this entry and start a new upload.
      </p>
      <Label htmlFor="retry-file" className="mt-5 block text-xs">
        Original video
      </Label>
      <Input
        id="retry-file"
        type="file"
        className="mt-2 h-auto py-2"
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={busy || !file} onClick={() => void retry()}>
          <Upload className="size-4" />
          {busy ? (progress < 100 ? `${progress}% sent` : "Validating & saving…") : "Retry upload"}
        </Button>
        {busy && (
          <Button variant="outline" onClick={() => controller.current?.abort()}>
            <X className="size-4" />
            Cancel request
          </Button>
        )}
      </div>
    </section>
  );
}
export default function RecordingPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const canManage = !!user?.permissions.includes("videos:manage");
  const [video, setVideo] = useState<Video | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [playingBusy, setPlayingBusy] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [unsupportedPlayback, setUnsupportedPlayback] = useState(false);
  const player = useRef<RecordingPlayerHandle>(null);
  const resumeState = useRef<RecordingPlaybackState | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const version = useRef(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (!user) return;
    const current = ++version.current;
    setBusy(true);
    setPlayingBusy(false);
    setError("");
    api
      .video(videoId)
      .then((result) => {
        if (version.current === current) setVideo(result);
      })
      .catch((err: unknown) => {
        if (version.current === current) {
          setError(errorMessage(err));
          notifyError(err);
        }
      })
      .finally(() => {
        if (version.current === current) setBusy(false);
      });
    return () => {
      version.current += 1;
    };
  }, [user, videoId, revision]);
  useEffect(() => {
    setPlayback(null);
    setPlayerError("");
    setUnsupportedPlayback(false);
    resumeState.current = undefined;
    setPlayingBusy(false);
  }, [videoId]);
  async function openPlayer() {
    setPlayingBusy(true);
    setPlayerError("");
    setUnsupportedPlayback(false);
    const current = version.current;
    try {
      const result = await api.playback(videoId);
      if (current === version.current) {
        // Capture after the HTTP request, just before replacing the playing source.
        resumeState.current = player.current?.getPlaybackState();
        setPlayback(result);
        // Renewals within one signing second can return the same URL; retry anyway.
        setPlaybackRevision((n) => n + 1);
        if (playback) toast.success("Playback link refreshed.");
      }
    } catch (err) {
      if (current === version.current) {
        setPlayerError(errorMessage(err));
        notifyError(err);
      }
    } finally {
      if (current === version.current) setPlayingBusy(false);
    }
  }
  async function remove() {
    if (!video) return;
    setDeleteBusy(true);
    try {
      await api.deleteVideo(video.video_id);
      toast.success("Recording and stored files deleted.");
      router.replace("/library");
    } catch (err) {
      notifyError(err);
    } finally {
      setDeleteBusy(false);
    }
  }
  if (busy)
    return (
      <div className="panel">
        <LoadingRows label="Loading recording" />
      </div>
    );
  if (error || !video)
    return (
      <>
        <Button asChild variant="ghost" className="mb-5">
          <Link href="/library">
            <ArrowLeft className="size-4" />
            Recording library
          </Link>
        </Button>
        <div className="panel">
          <LoadError message={error || "Recording unavailable."} retry={reload} />
        </div>
      </>
    );
  return (
    <>
      <Link href="/library" className="subtle-link mb-5">
        <ArrowLeft className="size-3.5" />
        Recording library
      </Link>
      <PageHeading
        title={video.title}
        description={`${video.camera.name}${video.camera.location ? ` · ${video.camera.location}` : ""}`}
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={video.upload_state === "deleting"}
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
                Edit details
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setDeleting(true)}
              >
                {video.upload_state === "deleting" ? "Retry deletion" : "Delete"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Recording playback</h2>
              <span
                className={`status-pill ${video.upload_state === "ready" ? "status-pill-active" : ""}`}
              >
                <span className="status-dot" />
                {uploadStateLabels[video.upload_state]}
              </span>
            </div>
            {video.upload_state === "ready" ? (
              <>
                <div className="flex aspect-video items-center justify-center bg-sidebar">
                  {playback ? (
                    <RecordingPlayer
                      key={`${videoId}:${playbackRevision}`}
                      ref={player}
                      src={playback.url}
                      poster={playback.thumbnail_url}
                      title={video.title}
                      initialState={resumeState.current}
                      onResumeBlocked={() => toast.info("Press play to resume the recording.")}
                      onPlaybackError={(code) => {
                        const unsupported = code === 3 || code === 4;
                        setUnsupportedPlayback(unsupported && playback.rendition === "original");
                        setPlayerError(
                          unsupported
                            ? playback.rendition === "original"
                              ? "This browser could not decode the original. You can request an MP4 playback copy below. The original remains stored."
                              : "This browser could not decode the prepared MP4 copy. Contact an administrator to check the recording and browser."
                            : "Playback failed. Refresh the private link and check your connection before retrying.",
                        );
                        toast.error("The browser could not play this recording.");
                      }}
                    />
                  ) : (
                    <div className="px-6 text-center text-sidebar-foreground">
                      <FileVideo
                        className="mx-auto mb-5 size-10 text-sidebar-muted"
                        strokeWidth={1.2}
                      />
                      <p className="text-sm font-medium">View the stored original</p>
                      <p className="mt-2 text-xs text-sidebar-muted">
                        A private, temporary link is issued when you open the player.
                      </p>
                      <Button
                        className="mt-6 bg-sage text-sidebar hover:bg-sage/90"
                        disabled={playingBusy}
                        onClick={() => void openPlayer()}
                      >
                        {playingBusy ? "Opening…" : "Open player"}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatDuration(video.duration_seconds)} · {video.width} × {video.height} ·{" "}
                    {video.video_codec}
                    {playback?.rendition === "playback" && " · Viewing MP4 copy"}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={playingBusy}
                    onClick={() => void openPlayer()}
                  >
                    <RefreshCw className="size-3.5" />
                    {playingBusy ? "Refreshing…" : "Refresh playback link"}
                  </Button>
                </div>
                {playback && (
                  <details className="border-t px-5 py-3 text-xs text-muted-foreground">
                    <summary className="w-fit cursor-pointer rounded-sm py-1 font-medium text-foreground">
                      Player shortcuts
                    </summary>
                    <p className="mt-2 max-w-prose leading-6">
                      Focus the player first. Space or K: play/pause · ← / →: seek 10 seconds · M:
                      mute · F: fullscreen · I: picture-in-picture · &lt; / &gt;: playback speed. On
                      touch screens, double-tap the left or right side to seek.
                    </p>
                  </details>
                )}
                {video.content_type === "video/mpeg" && playback?.rendition !== "playback" && (
                  <p className="border-t bg-muted/40 px-5 py-4 text-xs leading-6 text-muted-foreground">
                    This is an MPEG original. Your browser may require an H.264 MP4 copy for
                    playback. The original file is preserved; uploading does not convert or index
                    it.
                  </p>
                )}
                {playerError && (
                  <p className="border-t px-5 py-4 text-xs leading-6 text-destructive" role="alert">
                    {playerError}
                  </p>
                )}
                <PlaybackPreparationPanel
                  key={videoId}
                  videoId={videoId}
                  unsupported={unsupportedPlayback}
                  canManage={canManage}
                  usingPreparedCopy={playback?.rendition === "playback"}
                  opening={playingBusy}
                  onOpen={() => void openPlayer()}
                />
              </>
            ) : (
              <div className="empty-state">
                <FileVideo className="mb-5 size-8 text-primary" strokeWidth={1.4} />
                <h3 className="font-semibold">
                  {video.upload_state === "deleting"
                    ? "Deletion is pending"
                    : "The original is not available yet"}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                  {video.upload_state === "deleting"
                    ? "Files stay hidden until deletion finishes. An administrator can retry deletion if storage was unavailable."
                    : video.last_error ||
                      "The recording is registered, but its video bytes have not finished saving."}
                </p>
              </div>
            )}
          </section>
          {canManage && ["pending", "failed", "uploading"].includes(video.upload_state) && (
            <RetryUpload video={video} onSaved={reload} />
          )}
          {video.description && (
            <section className="panel p-6">
              <h2 className="panel-title">Recording notes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {video.description}
              </p>
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="panel-title">Recording context</h2>
            <dl className="mt-5 space-y-5 text-xs">
              {[
                { label: "Camera", value: video.camera.name },
                { label: "Location", value: video.camera.location || "Not specified" },
                {
                  label: "Captured from",
                  value: formatRecorded(video.recording_start, video.recording_timezone),
                },
                {
                  label: "Captured until",
                  value: video.recording_end
                    ? formatRecorded(video.recording_end, video.recording_timezone)
                    : "Derived after upload",
                },
                { label: "Camera timezone", value: video.recording_timezone },
                { label: "Registered", value: formatDate(video.created_at) },
                { label: "File", value: video.original_filename },
                { label: "Size", value: formatBytes(video.byte_size ?? video.expected_byte_size) },
                {
                  label: "Thumbnail",
                  value:
                    video.thumbnail_state === "ready"
                      ? "Available"
                      : video.thumbnail_state === "failed"
                        ? "Unavailable"
                        : "Pending",
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1.5 break-words font-medium leading-6">{item.value}</dd>
                </div>
              ))}
            </dl>
            <Link href="/cameras" className="subtle-link mt-6">
              <Camera className="size-3.5" />
              Camera directory
            </Link>
          </section>
          <section className="panel p-6">
            <h2 className="panel-title">Indexing</h2>
            <p className="mt-3 text-xs font-medium">Not indexed</p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              The file can be viewed without indexing. Processing is outside the current
              implementation.
            </p>
            {canManage && (
              <Button
                disabled
                className="mt-5 w-full"
                title="Indexing and queue publication are not connected"
              >
                Process unavailable
              </Button>
            )}
          </section>
        </aside>
      </div>
      {editing && (
        <RecordingEditor video={video} onClose={() => setEditing(false)} onSaved={reload} />
      )}
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!deleteBusy) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {video.title}, its original file, thumbnail and library metadata permanently.
              Administrative audit entries are retained without the footage or its description.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void remove()}>
              {deleteBusy ? "Deleting…" : "Delete recording"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

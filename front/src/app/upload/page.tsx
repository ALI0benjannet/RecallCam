"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera as CameraIcon, FileVideo, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  FieldError,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, errorFields, errorMessage, uploadVideoContent } from "@/lib/api-client";
import { cameraTimeOffsets, formatBytes } from "@/lib/media";
import type { Camera, UploadPolicy, Video } from "@/lib/types";
export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraTotal, setCameraTotal] = useState(0);
  const [cameraPage, setCameraPage] = useState(1);
  const [moreBusy, setMoreBusy] = useState(false);
  const [policy, setPolicy] = useState<UploadPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [localStart, setLocalStart] = useState("");
  const [offset, setOffset] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Video | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const camera = cameras.find((item) => item.camera_id === cameraId);
  const offsets = useMemo(
    () => (camera ? cameraTimeOffsets(localStart, camera.timezone) : []),
    [camera, localStart],
  );
  useEffect(() => {
    setOffset(offsets.length === 1 ? offsets[0] : "");
  }, [offsets]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!user?.permissions.includes("videos:manage")) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.cameras(new URLSearchParams({ page: "1", page_size: "100" })),
      api.uploadPolicy(),
    ])
      .then(([result, limits]) => {
        if (active) {
          setCameras(result.items);
          setCameraTotal(result.total);
          setCameraPage(1);
          setPolicy(limits);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError(errorMessage(err));
          notifyError(err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, revision]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function moreCameras() {
    setMoreBusy(true);
    try {
      const result = await api.cameras(
        new URLSearchParams({ page: String(cameraPage + 1), page_size: "100" }),
      );
      if (mounted.current) {
        setCameras((items) => [
          ...new Map([...items, ...result.items].map((item) => [item.camera_id, item])).values(),
        ]);
        setCameraTotal(result.total);
        setCameraPage(result.page);
      }
    } catch (err) {
      notifyError(err);
    } finally {
      if (mounted.current) setMoreBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !policy || !camera || !offset || !title.trim()) {
      toast.error("Choose a file, camera, title and valid recording start time.");
      return;
    }
    if (!file.size || file.size > policy.max_bytes) {
      toast.error(`Choose a nonempty video no larger than ${formatBytes(policy.max_bytes)}.`);
      return;
    }
    setBusy(true);
    setFields({});
    setProgress(0);
    controller.current = new AbortController();
    try {
      let recording = draft ? await api.video(draft.video_id) : null;
      if (recording?.upload_state === "ready") {
        toast.success("This recording has already been stored.");
        router.push(`/library/${recording.video_id}`);
        return;
      }
      if (!recording) {
        recording = await api.createVideo({
          camera_id: cameraId,
          original_filename: file.name,
          expected_byte_size: file.size,
          title: title.trim(),
          description: description.trim() || null,
          recording_start: `${localStart.length === 16 ? `${localStart}:00` : localStart}${offset}`,
        });
        if (mounted.current) setDraft(recording);
      }
      if (controller.current.signal.aborted) return;
      const saved = await uploadVideoContent(recording.video_id, file, {
        timeoutSeconds: policy.timeout_seconds,
        signal: controller.current.signal,
        onProgress: (percent) => {
          if (mounted.current) setProgress(percent);
        },
      });
      if (!mounted.current) return;
      toast.success("Recording stored. No processing job has been created.");
      if (saved.thumbnail_state === "failed")
        toast.info("The recording is saved, but its thumbnail is unavailable.");
      router.push(`/library/${saved.video_id}`);
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof DOMException && err.name === "AbortError")
        toast.info("Upload request canceled. Check the library; saving may already have finished.");
      else {
        setFields(errorFields(err));
        notifyError(err);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!user?.permissions.includes("videos:manage")) return null;
  return (
    <>
      <PageHeading
        title="Upload recordings"
        description="Save original footage with its camera and recording timeline. Processing remains a separate action."
      />
      {loading ? (
        <div className="panel">
          <LoadingRows label="Loading upload settings" />
        </div>
      ) : loadError ? (
        <div className="panel">
          <LoadError message={loadError} retry={() => setRevision((n) => n + 1)} />
        </div>
      ) : (
        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Add a recording</h2>
                <p className="panel-description">
                  Original file · private storage · no automatic indexing
                </p>
              </div>
              <Upload className="size-5 text-primary" />
            </div>
            <form
              onSubmit={submit}
              onInvalid={() =>
                toast.error("Complete the required recording fields.", { id: "video-validation" })
              }
              className="space-y-6 p-6 sm:p-8"
            >
              <div className="form-field">
                <Label htmlFor="recording-file">Video file</Label>
                <div className="rounded-xl border border-dashed border-primary/30 bg-muted/40 p-6">
                  <FileVideo className="mb-4 size-7 text-primary" strokeWidth={1.4} />
                  <Input
                    id="recording-file"
                    type="file"
                    accept={policy?.extensions.join(",")}
                    required={!file}
                    disabled={busy}
                    className="h-auto border-0 bg-transparent p-0 text-sm file:mr-4 file:rounded-md file:bg-sage file:px-3 file:py-1 file:text-primary"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] ?? null;
                      setFile(selected);
                      setDraft(null);
                      setFields({});
                      setProgress(0);
                      if (selected) setTitle(selected.name.replace(/\.[^.]+$/, "").slice(0, 200));
                    }}
                  />
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    {file
                      ? `${file.name} · ${formatBytes(file.size)}`
                      : "Choose an original video file."}
                  </p>
                  <p className="field-help mt-2">
                    {policy?.extensions.join(", ").toUpperCase()} · Up to{" "}
                    {formatBytes(policy?.max_bytes ?? 0)}
                  </p>
                </div>
                {file && /\.(mpg|mpeg)$/i.test(file.name) && (
                  <p className="field-help">
                    MPEG originals can be stored and used for thumbnails. Playback depends on your
                    browser; an H.264 MP4 copy may be needed for viewing.
                  </p>
                )}
                <FieldError message={fields.original_filename || fields.expected_byte_size} />
              </div>
              <div className="form-field">
                <Label htmlFor="video-title">Title</Label>
                <Input
                  id="video-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setDraft(null);
                  }}
                  disabled={busy}
                  required
                  maxLength={200}
                  aria-invalid={!!fields.title}
                />
                <FieldError message={fields.title} />
              </div>
              <div className="form-field">
                <Label htmlFor="video-camera">Source camera</Label>
                <Select
                  value={cameraId}
                  onValueChange={(value) => {
                    setCameraId(value);
                    setDraft(null);
                  }}
                  disabled={busy || !cameras.length}
                >
                  <SelectTrigger id="video-camera" className="w-full">
                    <SelectValue placeholder="Choose an active camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((item) => (
                      <SelectItem value={item.camera_id} key={item.camera_id}>
                        {item.name}
                        {item.location ? ` — ${item.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fields.camera_id} />
                {!cameras.length && (
                  <p className="field-help">
                    No active cameras.{" "}
                    <Link href="/cameras" className="subtle-link">
                      Create a camera first
                    </Link>
                    .
                  </p>
                )}
                {cameras.length < cameraTotal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || moreBusy}
                    onClick={() => void moreCameras()}
                  >
                    {moreBusy ? "Loading…" : "Load more cameras"}
                  </Button>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
                <div className="form-field">
                  <Label htmlFor="recording-start">Recording start</Label>
                  <Input
                    id="recording-start"
                    type="datetime-local"
                    step="1"
                    required
                    value={localStart}
                    onChange={(event) => {
                      setLocalStart(event.target.value);
                      setDraft(null);
                    }}
                    disabled={busy}
                    aria-invalid={!!fields.recording_start}
                  />
                  <p className="field-help">
                    Camera time{camera ? ` · ${camera.timezone}` : " — choose a camera first"}. This
                    is not the upload time.
                  </p>
                  <FieldError
                    message={
                      fields.recording_start ||
                      (localStart && camera && !offsets.length
                        ? "This local time is invalid in the camera timezone. Check daylight-saving transitions."
                        : undefined)
                    }
                  />
                </div>
                <div className="form-field content-start">
                  <Label htmlFor="recording-offset">UTC offset</Label>
                  <Select
                    value={offset}
                    onValueChange={(value) => {
                      setOffset(value);
                      setDraft(null);
                    }}
                    disabled={busy || !offsets.length}
                  >
                    <SelectTrigger id="recording-offset" className="w-full">
                      <SelectValue placeholder="Choose offset" />
                    </SelectTrigger>
                    <SelectContent>
                      {offsets.map((value) => (
                        <SelectItem key={value} value={value}>
                          UTC{value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="field-help">
                    {offsets.length > 1
                      ? "This clock time occurs twice. Choose the offset used by the recording."
                      : "Resolved from the camera timezone and recording date."}
                  </p>
                </div>
              </div>
              <div className="form-field">
                <Label htmlFor="video-description">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="video-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setDraft(null);
                  }}
                  disabled={busy}
                  maxLength={2000}
                  placeholder="Useful context about this recording"
                />
                <FieldError message={fields.description} />
              </div>
              {busy && (
                <div className="rounded-lg border bg-muted/40 p-4" role="status">
                  <div className="flex justify-between gap-4 text-xs">
                    <span>
                      {progress < 100
                        ? "Sending video bytes…"
                        : "Validating the video and saving to storage…"}
                    </span>
                    <span className="tabular-nums">{progress}% sent</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="File transfer"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
                  >
                    <div
                      className="h-full bg-primary transition-[width] duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    100% sent does not mean saving is complete. Keep this page open for
                    confirmation.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t pt-6">
                <Button
                  type="submit"
                  disabled={busy || !file || !camera || !offset || !title.trim()}
                >
                  <Upload className="size-4" />
                  {busy ? "Saving recording…" : draft ? "Retry upload" : "Upload & store"}
                </Button>
                {busy ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => controller.current?.abort()}
                  >
                    <X className="size-4" />
                    Cancel request
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <Link href="/library">
                      Open library
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </form>
          </section>
          <aside className="panel p-6">
            <h2 className="panel-title">Stored first. Processed later.</h2>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              The backend checks the media, reads its duration and dimensions, and creates one
              thumbnail with FFprobe/FFmpeg. The original file is preserved.
            </p>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              No CV, captions, embeddings, queue jobs or model requests run during upload.
            </p>
            <div className="mt-6 border-t pt-5">
              <Link href="/cameras" className="subtle-link">
                <CameraIcon className="size-4" />
                Manage source cameras
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

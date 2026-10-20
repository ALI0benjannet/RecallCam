"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, FileVideo, RefreshCw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  EmptyState,
  LoadError,
  LoadingRows,
  notifyError,
  PageHeading,
  Pagination,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api-client";
import { formatBytes, formatDuration, formatRecorded } from "@/lib/media";
import { uploadStateLabels, type Camera, type Page, type Video } from "@/lib/types";
export default function LibraryPage() {
  const { user } = useAuth();
  const canManage = !!user?.permissions.includes("videos:manage");
  const [data, setData] = useState<Page<Video> | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraPage, setCameraPage] = useState(0);
  const [cameraTotal, setCameraTotal] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [camera, setCamera] = useState("all");
  const [state, setState] = useState("all");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);
  const loadCameras = useCallback(async (nextPage = 1) => {
    setCameraBusy(true);
    setCameraError(false);
    try {
      const result = await api.cameras(
        new URLSearchParams({ page: String(nextPage), page_size: "100", include_archived: "true" }),
      );
      if (mounted.current) {
        setCameras((previous) =>
          nextPage === 1
            ? result.items
            : [
                ...new Map(
                  [...previous, ...result.items].map((item) => [item.camera_id, item]),
                ).values(),
              ],
        );
        setCameraTotal(result.total);
        setCameraPage(nextPage);
      }
    } catch (err) {
      if (mounted.current) {
        setCameraError(true);
        notifyError(err);
      }
    } finally {
      if (mounted.current) setCameraBusy(false);
    }
  }, []);
  useEffect(() => {
    if (user) void loadCameras();
  }, [user, loadCameras]);
  useEffect(() => {
    if (!user) return;
    const version = ++requestId.current;
    setBusy(true);
    setError("");
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    params.set("page_size", "20");
    api
      .videos(params)
      .then((result) => {
        if (version !== requestId.current) return;
        const last = Math.max(1, Math.ceil(result.total / 20));
        if (page > last) {
          setPage(last);
          return;
        }
        setData(result);
      })
      .catch((err: unknown) => {
        if (version === requestId.current) {
          setError(errorMessage(err));
          notifyError(err);
        }
      })
      .finally(() => {
        if (version === requestId.current) setBusy(false);
      });
    return () => {
      requestId.current += 1;
    };
  }, [user, query, page, revision]);
  function apply(event: FormEvent) {
    event.preventDefault();
    if (from && until && from >= until) {
      toast.error("The period end must be later than its start.");
      return;
    }
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (camera !== "all") params.set("camera_id", camera);
    if (canManage && state !== "all") params.set("upload_state", state);
    if (from) params.set("start_from", `${from}:00Z`);
    if (until) params.set("end_before", `${until}:00Z`);
    setQuery(params.toString());
    setPage(1);
    setRevision((n) => n + 1);
  }
  return (
    <>
      <PageHeading
        title="Recording library"
        description="Browse original footage by camera and recording period. Stored videos are available before indexing."
        action={
          canManage ? (
            <Button asChild>
              <Link href="/upload">
                <Upload className="size-4" />
                Upload recording
              </Link>
            </Button>
          ) : undefined
        }
      />
      <section className="table-shell">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Shared recordings
              {!busy && !error && data && (
                <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {data.total}
                </span>
              )}
            </h2>
            <p className="panel-description">
              Recording times use each video’s saved camera timezone
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label="Refresh library"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <form
          onSubmit={apply}
          onInvalid={() =>
            toast.error("Choose valid period bounds.", { id: "library-filter-validation" })
          }
          className="space-y-4 border-b p-5"
        >
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search recordings by title, filename or camera"
                placeholder="Search recordings or cameras"
                className="bg-muted/45 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={camera} onValueChange={setCamera}>
              <SelectTrigger aria-label="Filter by camera" className="w-full lg:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cameras</SelectItem>
                {cameras.map((item) => (
                  <SelectItem key={item.camera_id} value={item.camera_id}>
                    {item.name}
                    {!item.is_active ? " (archived)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <Select value={state} onValueChange={setState}>
                <SelectTrigger aria-label="Filter upload state" className="w-full lg:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All upload states</SelectItem>
                  {Object.entries(uploadStateLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="form-field min-w-0 flex-1">
              <Label htmlFor="period-from" className="text-xs">
                From (UTC)
              </Label>
              <Input
                id="period-from"
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="form-field min-w-0 flex-1">
              <Label htmlFor="period-until" className="text-xs">
                Until (UTC, exclusive)
              </Label>
              <Input
                id="period-until"
                type="datetime-local"
                value={until}
                onChange={(event) => setUntil(event.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setCamera("all");
                setState("all");
                setFrom("");
                setUntil("");
                setQuery("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
          {(cameraError || cameras.length < cameraTotal) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cameraBusy}
              onClick={() => void loadCameras(cameraPage + 1)}
            >
              {cameraBusy
                ? "Loading cameras…"
                : cameraError
                  ? "Retry camera options"
                  : "Load more camera options"}
            </Button>
          )}
        </form>
        {busy ? (
          <LoadingRows label="Loading recordings" />
        ) : error ? (
          <LoadError message={error} retry={() => setRevision((n) => n + 1)} />
        ) : !data?.items.length ? (
          <EmptyState
            title={query ? "No matching recordings" : "Your archive starts here"}
            description={
              query
                ? "Try a different camera, period or search term."
                : canManage
                  ? "Upload footage with its camera and original start time. It will be stored without launching any processing."
                  : "Recordings will appear when an administrator uploads them."
            }
            action={
              canManage && !query ? (
                <Button asChild variant="outline">
                  <Link href="/upload">
                    <Upload className="size-4" />
                    Upload a recording
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Recording</TableHead>
                  <TableHead>Camera</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead className="pr-5 text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.video_id}>
                    <TableCell className="max-w-sm pl-5">
                      <Link
                        href={`/library/${item.video_id}`}
                        className="group flex items-center gap-3.5"
                      >
                        <span className="relative grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                          <FileVideo className="size-5 text-primary" strokeWidth={1.4} />
                          {item.thumbnail_url && (
                            <img
                              src={item.thumbnail_url}
                              alt=""
                              className="absolute inset-0 h-full w-full bg-muted object-contain"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-64 truncate text-[13px] font-semibold group-hover:text-primary">
                            {item.title}
                          </p>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            {formatDuration(item.duration_seconds)} ·{" "}
                            {formatBytes(item.byte_size ?? item.expected_byte_size)}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{item.camera.name}</p>
                      <p className="mt-1.5 max-w-48 truncate text-[11px] text-muted-foreground">
                        {item.camera.location || "Location not specified"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p>{formatRecorded(item.recording_start, item.recording_timezone)}</p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {item.recording_timezone}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`status-pill ${item.upload_state === "ready" ? "status-pill-active" : item.upload_state === "failed" ? "text-destructive" : ""}`}
                      >
                        <span className="status-dot" />
                        {uploadStateLabels[item.upload_state]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">Not indexed</TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/library/${item.video_id}`} aria-label={`Open ${item.title}`}>
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
          </>
        )}
      </section>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        No recording is queued or indexed automatically. Indexing and evidence search remain
        unavailable.
      </p>
    </>
  );
}

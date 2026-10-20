"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  Camera as CameraIcon,
  MapPin,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  EmptyState,
  FieldError,
  LoadingRows,
  LoadError,
  notifyError,
  PageHeading,
  Pagination,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { api, errorFields, errorMessage } from "@/lib/api-client";
import type { Camera, Page } from "@/lib/types";

function CameraEditor({
  item,
  onClose,
  onSaved,
}: {
  item: Camera | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = item !== "new";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [zone] = useState(() =>
    editing ? item.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFields({});
    setError("");
    const data = new FormData(event.currentTarget);
    const timezone = String(data.get("timezone")).trim();
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      setFields({
        timezone: "Use an IANA timezone such as Africa/Tunis or UTC.",
      });
      toast.error("Choose a valid recording timezone.");
      return;
    }
    const body = {
      name: String(data.get("name")).trim(),
      location: String(data.get("location")).trim() || null,
      description: String(data.get("description")).trim() || null,
      timezone,
    };
    setBusy(true);
    try {
      if (editing) await api.updateCamera(item.camera_id, body);
      else await api.createCamera(body);
      toast.success(editing ? "Camera details updated." : "Camera created.");
      onSaved();
      onClose();
    } catch (err) {
      setFields(errorFields(err));
      setError(errorMessage(err));
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit camera" : "Create camera"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Keep this camera’s location and recording defaults accurate."
              : "Give the camera a clear name, location and recording timezone."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          onInvalid={() =>
            toast.error("Check the required camera fields.", {
              id: "camera-validation",
            })
          }
          className="space-y-5 pt-3"
        >
          <div className="form-field">
            <Label htmlFor="camera-name">Camera name</Label>
            <Input
              id="camera-name"
              name="name"
              defaultValue={editing ? item.name : ""}
              placeholder="e.g. Main entrance"
              required
              maxLength={120}
              disabled={busy}
              aria-invalid={!!fields.name}
            />
            <FieldError message={fields.name} />
          </div>
          <div className="form-field">
            <Label htmlFor="camera-location">
              Location <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="camera-location"
              name="location"
              defaultValue={editing ? (item.location ?? "") : ""}
              placeholder="e.g. Building A, ground floor"
              maxLength={200}
              disabled={busy}
              aria-invalid={!!fields.location}
            />
            <FieldError message={fields.location} />
          </div>
          <div className="form-field">
            <Label htmlFor="camera-timezone">Recording timezone</Label>
            <Input
              id="camera-timezone"
              name="timezone"
              defaultValue={zone}
              list="camera-timezones"
              required
              maxLength={100}
              disabled={busy}
              aria-invalid={!!fields.timezone}
              aria-describedby="timezone-help"
            />
            <datalist id="camera-timezones">
              {Array.from(
                new Set([
                  zone,
                  "UTC",
                  "Africa/Tunis",
                  "Europe/Paris",
                  "Europe/London",
                  "America/New_York",
                  "Asia/Dubai",
                ]),
              ).map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="field-help" id="timezone-help">
              Used as the default when recording start times are entered. Existing recording
              timestamps will not be changed.
            </p>
            <FieldError message={fields.timezone} />
          </div>
          <div className="form-field">
            <Label htmlFor="camera-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="camera-description"
              name="description"
              defaultValue={editing ? (item.description ?? "") : ""}
              placeholder="What does this camera cover?"
              rows={3}
              maxLength={2000}
              disabled={busy}
              aria-invalid={!!fields.description}
            />
            <FieldError message={fields.description} />
          </div>
          {error && (
            <p role="alert" className="text-sm leading-6 text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create camera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default function CamerasPage() {
  const { user } = useAuth();
  const canManage = user?.permissions.includes("cameras:manage") ?? false;
  const requestVersion = useRef(0);
  const [data, setData] = useState<Page<Camera> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<Camera | "new" | null>(null);
  const [toggle, setToggle] = useState<Camera | null>(null);
  const [mutating, setMutating] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    const current = ++requestVersion.current;
    setBusy(true);
    setError("");
    try {
      const result = await api.cameras(
        new URLSearchParams({
          page: String(page),
          page_size: "20",
          search,
          include_archived: String(includeArchived),
        }),
      );
      if (current !== requestVersion.current) return;
      setData(result);
      if (!result.items.length && result.total > 0 && page > 1) setPage(page - 1);
    } catch (err) {
      if (current !== requestVersion.current) return;
      setError(errorMessage(err));
      notifyError(err);
    } finally {
      if (current === requestVersion.current) setBusy(false);
    }
  }, [user, page, search, includeArchived]);
  useEffect(
    () => () => {
      requestVersion.current += 1;
    },
    [],
  );
  useEffect(() => {
    void load();
  }, [load, revision]);
  async function toggleStatus() {
    if (!toggle) return;
    setMutating(true);
    try {
      await api.updateCamera(toggle.camera_id, {
        is_active: !toggle.is_active,
      });
      toast.success(
        toggle.is_active ? "Camera archived. Its history has been retained." : "Camera restored.",
      );
      setToggle(null);
      setRevision((n) => n + 1);
    } catch (err) {
      notifyError(err);
    } finally {
      setMutating(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Cameras"
        description={
          canManage
            ? "Organize cameras by location and keep their recording timezones accurate."
            : "The cameras available in your shared investigation workspace."
        }
        action={
          canManage ? (
            <Button onClick={() => setEditor("new")}>
              <Plus className="size-4" />
              Create camera
            </Button>
          ) : undefined
        }
      />
      <div className="table-shell">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Camera directory
              {!busy && !error && data && (
                <span className="ml-2.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {data.total}
                </span>
              )}
            </h2>
            <p className="panel-description">Locations, recording timezones and camera records.</p>
          </div>
        </div>
        <div className="list-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draft.trim());
              setPage(1);
            }}
            className="flex w-full gap-2 sm:max-w-md"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search cameras by name or location"
                placeholder="Search name or location"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-10 bg-muted/45 pl-9"
              />
            </div>
            <Button variant="outline" type="submit" className="h-10 bg-card">
              Search
            </Button>
          </form>
          <label className="flex cursor-pointer items-center gap-2.5 whitespace-nowrap text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => {
                setIncludeArchived(event.target.checked);
                setPage(1);
              }}
              className="size-4 accent-primary"
            />
            Include archived
          </label>
        </div>
        {busy ? (
          <LoadingRows label="Loading cameras" />
        ) : error ? (
          <LoadError message={error} retry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            title={search ? "No matching cameras" : "Your camera directory is empty"}
            description={
              search
                ? "Try a different camera name or location."
                : canManage
                  ? "Create your first camera to organize recordings by location and time."
                  : "An administrator needs to add cameras to this workspace."
            }
            action={
              !search && canManage ? (
                <Button variant="outline" onClick={() => setEditor("new")}>
                  <Plus className="size-4" />
                  Create camera
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Camera</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="hidden lg:table-cell">Recording timezone</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="pr-5 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.camera_id}>
                    <TableCell className="max-w-xs py-5 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="entity-icon">
                          <CameraIcon className="size-[18px]" strokeWidth={1.5} />
                        </span>
                        <p className="whitespace-normal font-semibold">{item.name}</p>
                      </div>
                      {item.description && (
                        <p className="mt-1.5 max-w-sm whitespace-normal text-xs leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] text-muted-foreground lg:hidden">
                        {item.timezone}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                      {item.location || "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {item.timezone}
                    </TableCell>
                    <TableCell>
                      <span className={`status-pill ${item.is_active ? "status-pill-active" : ""}`}>
                        <span className="status-dot" />
                        {item.is_active ? "Active" : "Archived"}
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell className="pr-5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${item.name}`}
                            title="Edit camera"
                            onClick={() => setEditor(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${item.is_active ? "Archive" : "Restore"} ${item.name}`}
                            title={item.is_active ? "Archive camera" : "Restore camera"}
                            onClick={() => setToggle(item)}
                          >
                            {item.is_active ? (
                              <Archive className="size-4 text-destructive" />
                            ) : (
                              <ArchiveRestore className="size-4 text-primary" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
        <MapPin className="mt-1 size-4 shrink-0" />
        Camera records describe where footage comes from. Adding a camera does not connect a live
        stream.
      </p>
      {editor && canManage && (
        <CameraEditor
          key={editor === "new" ? "new" : editor.camera_id}
          item={editor}
          onClose={() => setEditor(null)}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
      <AlertDialog
        open={!!toggle}
        onOpenChange={(open) => {
          if (!open && !mutating) setToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggle?.is_active ? "Archive this camera?" : "Restore this camera?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggle?.is_active
                ? `${toggle.name} will be marked archived. Its record and recording history will be retained.`
                : `${toggle?.name} will return to the active camera directory.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <Button
              variant={toggle?.is_active ? "destructive" : "default"}
              disabled={mutating}
              onClick={() => void toggleStatus()}
            >
              {mutating ? "Updating…" : toggle?.is_active ? "Archive camera" : "Restore camera"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

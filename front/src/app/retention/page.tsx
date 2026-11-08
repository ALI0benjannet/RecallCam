"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  FieldError,
  LoadError,
  LoadingRows,
  notifyError,
  PageHeading,
  Pagination,
  formatDate,
} from "@/components/feedback";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorFields, errorMessage } from "@/lib/api-client";
import type { RetentionPolicy, RetentionPreview } from "@/lib/types";

export default function RetentionPage() {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [days, setDays] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [daysError, setDaysError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<RetentionPreview | null>(null);
  const [confirmation, setConfirmation] = useState<RetentionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setPolicy(null);
    setFormError("");
    setDaysError("");
    setPreview(null);
    setPreviewError("");
    api.retentionPolicy(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setPolicy(result);
        setDays(String(result.retention_days));
        setEnabled(result.enabled);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(errorMessage(error));
        notifyError(error);
      },
    );
    return () => controller.abort();
  }, [reload]);

  function validatedDays(): number | null {
    const value = Number(days);
    if (!/^\d+$/.test(days) || !Number.isInteger(value) || value < 1 || value > 3650) {
      const message = "Enter a whole number from 1 to 3650.";
      setDaysError(message);
      toast.error(message, { id: "retention-days-validation" });
      return null;
    }
    setDaysError("");
    return value;
  }

  async function loadPreview(value: number, page: number): Promise<RetentionPreview | null> {
    setPreviewing(true);
    setPreviewError("");
    try {
      const result = await api.retentionPreview(value, page);
      setPreview(result);
      return result;
    } catch (error) {
      setPreviewError(errorMessage(error));
      notifyError(error);
      return null;
    } finally {
      setPreviewing(false);
    }
  }

  async function save(value: number, confirmed: boolean) {
    if (!policy || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const result = await api.updateRetentionPolicy({
        enabled,
        retention_days: value,
        expected_revision: policy.revision,
        confirm_deletion: confirmed,
      });
      setPolicy(result);
      setDays(String(result.retention_days));
      setEnabled(result.enabled);
      setPreview(null);
      setPreviewError("");
      toast.success(
        result.enabled
          ? "Retention saved. Automatic deletion is on."
          : "Retention saved. Automatic deletion is off.",
      );
    } catch (error) {
      setDaysError(errorFields(error).retention_days ?? "");
      setFormError(errorMessage(error));
      notifyError(error);
    } finally {
      setSaving(false);
      setConfirmation(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policy || previewing || saving || confirmation) return;
    const value = validatedDays();
    if (value === null) return;
    setFormError("");
    if (enabled && (!policy.enabled || value < policy.retention_days)) {
      const result = await loadPreview(value, 1);
      if (result) setConfirmation(result);
      return;
    }
    await save(value, false);
  }

  const busy = previewing || saving || confirmation !== null;
  const changed = policy && (enabled !== policy.enabled || Number(days) !== policy.retention_days);

  return (
    <>
      <PageHeading
        title="Recording retention"
        description="Choose how long recordings stay in the library and review what would expire."
      />
      {loadError ? (
        <div className="panel">
          <LoadError message={loadError} retry={() => setReload((value) => value + 1)} />
        </div>
      ) : !policy ? (
        <div className="panel">
          <LoadingRows label="Loading retention policy" />
        </div>
      ) : (
        <div className="grid items-start gap-7 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Retention policy</h2>
              <Badge variant={policy.enabled ? "secondary" : "outline"}>
                Automatic deletion {policy.enabled ? "on" : "off"}
              </Badge>
            </div>
            <form className="space-y-6 p-5 sm:p-6" onSubmit={submit} noValidate>
              <div className="form-field">
                <Label htmlFor="retention-days">Keep recordings for (days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  required
                  value={days}
                  disabled={busy}
                  aria-invalid={!!daysError}
                  aria-describedby={
                    daysError ? "retention-days-help retention-days-error" : "retention-days-help"
                  }
                  onChange={(event) => {
                    setDays(event.target.value);
                    setDaysError("");
                    setPreview(null);
                    setPreviewError("");
                  }}
                />
                <p className="field-help" id="retention-days-help">
                  Age is measured from the end of the recording. Older footage can become eligible
                  as soon as it finishes uploading.
                </p>
                <FieldError id="retention-days-error" message={daysError} />
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  id="retention-enabled"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={enabled}
                  disabled={busy}
                  aria-describedby="retention-enabled-help"
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                <div className="space-y-2">
                  <Label htmlFor="retention-enabled">Automatically delete expired recordings</Label>
                  <p id="retention-enabled-help" className="field-help">
                    The worker deletes eligible recordings and their stored copies. Turning this off
                    stops new deletions; those already started can still finish.
                  </p>
                </div>
              </div>
              {formError && (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => setReload((value) => value + 1)}
                  >
                    Reload policy
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const value = validatedDays();
                    if (value !== null) void loadPreview(value, 1);
                  }}
                >
                  {previewing ? "Loading preview…" : "Preview expiry"}
                </Button>
                <Button type="submit" disabled={busy || !changed}>
                  {saving ? "Saving…" : "Save policy"}
                </Button>
              </div>
            </form>
          </section>
          <section className="panel" aria-busy={previewing}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Expiry preview</h2>
                <p className="panel-description">The preview does not delete any recordings.</p>
              </div>
              {preview && (
                <Badge variant="outline">{preview.total.toLocaleString()} eligible</Badge>
              )}
            </div>
            {previewError && (
              <p role="alert" className="px-5 pt-4 text-sm text-destructive">
                {previewError}
              </p>
            )}
            {!preview ? (
              previewing ? (
                <LoadingRows label="Loading expiry preview" />
              ) : (
                <p className="px-5 py-7 text-sm text-muted-foreground">
                  Select Preview expiry to see which recordings match the proposed period.
                </p>
              )
            ) : (
              <>
                <p className="px-5 py-4 text-xs leading-6 text-muted-foreground">
                  Recordings that ended on or before {formatDate(preview.cutoff)} qualify. Uploads
                  and active playback preparations are excluded.
                </p>
                {preview.items.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recording</TableHead>
                        <TableHead>Camera</TableHead>
                        <TableHead>Recording ended</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.items.map((item) => (
                        <TableRow key={item.video_id}>
                          <TableCell>
                            <Link className="subtle-link" href={"/library/" + item.video_id}>
                              {item.title}
                            </Link>
                          </TableCell>
                          <TableCell>{item.camera_name}</TableCell>
                          <TableCell>{formatDate(item.recording_end)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="px-5 pb-6 text-sm text-muted-foreground">
                    {preview.total
                      ? "No recordings on this page."
                      : "No recordings currently qualify."}
                  </p>
                )}
                {(preview.total > preview.page_size || preview.page > 1) && (
                  <Pagination
                    page={preview.page}
                    pageSize={preview.page_size}
                    total={preview.total}
                    busy={busy}
                    onPage={(page) => void loadPreview(preview.retention_days, page)}
                  />
                )}
              </>
            )}
          </section>
        </div>
      )}
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply automatic deletion?</AlertDialogTitle>
            <AlertDialogDescription>
              The worker will permanently delete recordings older than{" "}
              {confirmation?.retention_days} days. The preview found{" "}
              {confirmation?.total.toLocaleString()} eligible recordings. The worker will also
              delete recordings that expire later while this policy is active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => {
                if (confirmation) void save(confirmation.retention_days, true);
              }}
            >
              {saving ? "Saving…" : "Confirm automatic deletion"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

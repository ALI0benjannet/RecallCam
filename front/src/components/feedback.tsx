"use client";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function notifyError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return;
  toast.error(errorMessage(error));
}
export function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div>
        <h1 className="page-title">
          {title}
          <span className="text-primary">.</span>
        </h1>
        <p className="page-description">{description}</p>
      </div>
      {action && <div className="shrink-0 sm:pt-1">{action}</div>}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl border bg-muted/60">
        <Inbox className="size-7 text-primary" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h2 className="font-semibold">Could not load this view</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={retry} className="mt-5">
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
export function LoadingRows({ label = "Loading records" }: { label?: string }) {
  return (
    <div className="space-y-4 p-6" role="status" aria-label={label}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
        />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  busy = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 text-xs text-muted-foreground">
      <p>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 records"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span className="px-2 tabular-nums">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || page * pageSize >= total}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileClock, Search, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  EmptyState,
  LoadingRows,
  LoadError,
  notifyError,
  PageHeading,
  Pagination,
  formatDate,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEvent, Page } from "@/lib/types";
export default function AuditPage() {
  const { user } = useAuth();
  const requestVersion = useRef(0);
  const [data, setData] = useState<Page<AuditEvent> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    if (!user?.permissions.includes("audit:read")) return;
    const current = ++requestVersion.current;
    setBusy(true);
    setError("");
    try {
      const result = await api.audit(
        new URLSearchParams({ page: String(page), page_size: "20", search }),
      );
      if (current !== requestVersion.current) return;
      setData(result);
    } catch (err) {
      if (current !== requestVersion.current) return;
      setError(errorMessage(err));
      notifyError(err);
    } finally {
      if (current === requestVersion.current) setBusy(false);
    }
  }, [user, page, search]);
  useEffect(
    () => () => {
      requestVersion.current += 1;
    },
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!user?.permissions.includes("audit:read")) return null;
  return (
    <>
      <PageHeading
        title="Audit log"
        description="Review recorded account, access and camera actions across the workspace."
      />
      <div className="table-shell">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Workspace activity
              {!busy && !error && data && (
                <span className="ml-2.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {data.total}
                </span>
              )}
            </h2>
            <p className="panel-description">A record of implemented application actions</p>
          </div>
          <FileClock className="size-5 text-primary" strokeWidth={1.5} />
        </div>
        <div className="list-toolbar">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draft.trim());
              setPage(1);
            }}
            className="flex w-full max-w-md gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search audit actions"
                placeholder="Search actions"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-10 bg-muted/45 pl-9"
              />
            </div>
            <Button variant="outline" type="submit" className="h-10 bg-card">
              Search
            </Button>
          </form>
        </div>
        {busy ? (
          <LoadingRows label="Loading audit events" />
        ) : error ? (
          <LoadError message={error} retry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            title="No audit events found"
            description={
              search
                ? "Try a different action name."
                : "Account, access and camera actions will appear here as they happen."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="pr-5">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.event_id}>
                    <TableCell className="whitespace-nowrap py-5 pl-5 text-xs tabular-nums text-muted-foreground">
                      {formatDate(item.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="entity-icon">
                          {item.resource_type === "camera" ? (
                            <Camera className="size-4" />
                          ) : item.resource_type === "user" ? (
                            <Users className="size-4" />
                          ) : (
                            <ShieldCheck className="size-4" />
                          )}
                        </span>
                        <div>
                          <p className="text-xs font-semibold">
                            {item.action.replace(/[._]/g, " ")}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{item.action}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs">
                      <p>{item.resource_type}</p>
                      <p className="mt-1.5 break-all text-[11px] text-muted-foreground">
                        {item.resource_id ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-xs break-all pr-5 text-[11px] text-muted-foreground">
                      {item.actor_id ?? "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        Query and returned-evidence auditing will be added with the investigation workflow. This
        view currently shows implemented application actions.
      </p>
    </>
  );
}

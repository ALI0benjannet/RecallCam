"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  FieldError,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, errorFields, errorMessage } from "@/lib/api-client";
import { roleDescriptions, roleLabels, type Page, type Role, type User } from "@/lib/types";

function RoleSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: Role;
  onChange: (value: Role) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(value) => onChange(value as Role)} disabled={disabled}>
      <SelectTrigger id="user-role" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(roleLabels).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function UserEditor({
  item,
  selfId,
  onClose,
  onSaved,
}: {
  item: User | "new";
  selfId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { refreshUser } = useAuth();
  const editing = item !== "new";
  const [role, setRole] = useState<Role>(editing ? item.role : "operator");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFields({});
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (editing)
        await api.updateUser(item.user_id, {
          display_name: String(data.get("display_name")).trim(),
          role,
        });
      else
        await api.createUser({
          email: String(data.get("email")).trim(),
          display_name: String(data.get("display_name")).trim(),
          password: String(data.get("password")),
          role,
        });
      toast.success(editing ? "User access updated." : "User account created.");
      if (editing && item.user_id === selfId) await refreshUser();
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
          <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this account’s name and workspace access."
              : "Create an account and give it the access it needs. Share the initial password privately."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          onInvalid={() =>
            toast.error("Check the required account fields.", {
              id: "user-form-validation",
            })
          }
          className="space-y-5 pt-3"
        >
          <div className="form-field">
            <Label htmlFor="user-name">Display name</Label>
            <Input
              id="user-name"
              name="display_name"
              defaultValue={editing ? item.display_name : ""}
              maxLength={120}
              required
              disabled={busy}
              autoComplete="name"
              aria-invalid={!!fields.display_name}
            />
            <FieldError message={fields.display_name} />
          </div>
          <div className="form-field">
            <Label htmlFor="user-email">Email address</Label>
            <Input
              id="user-email"
              name="email"
              type="email"
              defaultValue={editing ? item.email : ""}
              required
              maxLength={320}
              disabled={busy || editing}
              autoComplete="email"
              aria-invalid={!!fields.email}
            />
            <FieldError message={fields.email} />
            {editing && (
              <p className="field-help">The account’s email address cannot be changed here.</p>
            )}
          </div>
          {!editing && (
            <div className="form-field">
              <Label htmlFor="user-password">Initial password</Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
                disabled={busy}
                aria-invalid={!!fields.password}
              />
              <p className="field-help">Use between 12 and 128 characters.</p>
              <FieldError message={fields.password} />
            </div>
          )}
          <div className="form-field">
            <Label htmlFor="user-role">Role</Label>
            <RoleSelect
              value={role}
              onChange={setRole}
              disabled={busy || (editing && item.user_id === selfId)}
            />
            <p className="field-help">{roleDescriptions[role]}</p>
            <FieldError message={fields.role} />
            {editing && item.user_id === selfId && (
              <p className="field-help">Another administrator must change your own role.</p>
            )}
          </div>
          {error && (
            <p className="text-sm leading-6 text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ResetPassword({ item, onClose }: { item: User; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    setError("");
    setFields({});
    if (password !== data.get("confirm")) {
      setFields({ confirm: "The passwords do not match." });
      toast.error("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(item.user_id, password);
      toast.success("Password reset. The user must sign in again.");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {item.display_name}. Their existing access tokens will stop
            working.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={submit}
          onInvalid={() =>
            toast.error("Use a password between 12 and 128 characters.", {
              id: "reset-validation",
            })
          }
          className="space-y-5 pt-3"
        >
          {[
            { name: "password", label: "New password" },
            { name: "confirm", label: "Confirm password" },
          ].map((field) => (
            <div key={field.name} className="form-field">
              <Label htmlFor={`reset-${field.name}`}>{field.label}</Label>
              <Input
                id={`reset-${field.name}`}
                name={field.name}
                type="password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
                autoComplete="new-password"
                aria-invalid={!!fields[field.name]}
              />
              <FieldError message={fields[field.name]} />
            </div>
          ))}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default function UsersPage() {
  const { user } = useAuth();
  const requestVersion = useRef(0);
  const [data, setData] = useState<Page<User> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<User | "new" | null>(null);
  const [reset, setReset] = useState<User | null>(null);
  const [toggle, setToggle] = useState<User | null>(null);
  const [mutating, setMutating] = useState(false);
  const load = useCallback(async () => {
    if (!user?.permissions.includes("users:manage")) return;
    const current = ++requestVersion.current;
    setBusy(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      page_size: "20",
      search,
    });
    if (role !== "all") params.set("role", role);
    try {
      const result = await api.users(params);
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
  }, [user, page, search, role]);
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
      await api.updateUser(toggle.user_id, { is_active: !toggle.is_active });
      toast.success(
        toggle.is_active ? "User deactivated. Access has been removed." : "User reactivated.",
      );
      setToggle(null);
      setRevision((n) => n + 1);
    } catch (err) {
      notifyError(err);
    } finally {
      setMutating(false);
    }
  }
  if (!user?.permissions.includes("users:manage")) return null;
  return (
    <>
      <PageHeading
        title="Users & access"
        description="Create workspace accounts and manage what each person can do."
        action={
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />
      <div className="table-shell">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Workspace members
              {!busy && !error && data && (
                <span className="ml-2.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {data.total}
                </span>
              )}
            </h2>
            <p className="panel-description">Manage identities and role-based access.</p>
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
                aria-label="Search users by name or email"
                placeholder="Search name or email"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-10 bg-muted/45 pl-9"
              />
            </div>
            <Button variant="outline" type="submit" className="h-10 bg-card">
              Search
            </Button>
          </form>
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by role" className="w-full bg-card sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {Object.entries(roleLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {busy ? (
          <LoadingRows label="Loading users" />
        ) : error ? (
          <LoadError message={error} retry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            title={search ? "No matching users" : "No users found"}
            description={
              search
                ? "Try a different name or email address."
                : "Create an account to give someone access to the workspace."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.user_id}>
                    <TableCell className="py-5 pl-5">
                      <div className="flex items-center gap-3.5">
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-full bg-sage text-sm font-semibold text-sage-foreground"
                          aria-hidden="true"
                        >
                          {item.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold">
                            {item.display_name}
                            {item.user_id === user.user_id && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                You
                              </span>
                            )}
                          </p>
                          <p className="mt-1.5 text-xs text-muted-foreground">{item.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="rounded-md bg-muted/45 px-2.5 py-1 text-[11px] font-medium"
                      >
                        {roleLabels[item.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`status-pill ${item.is_active ? "status-pill-active" : ""}`}>
                        <span className="status-dot" />
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${item.display_name}`}
                          title="Edit user"
                          onClick={() => setEditor(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {item.user_id !== user.user_id && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Reset password for ${item.display_name}`}
                              title="Reset password"
                              onClick={() => setReset(item)}
                            >
                              <KeyRound className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`${item.is_active ? "Deactivate" : "Reactivate"} ${item.display_name}`}
                              title={item.is_active ? "Deactivate user" : "Reactivate user"}
                              onClick={() => setToggle(item)}
                            >
                              {item.is_active ? (
                                <UserRoundX className="size-4 text-destructive" />
                              ) : (
                                <UserRoundCheck className="size-4 text-primary" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
        <ShieldCheck className="mt-1 size-4 shrink-0" />
        Accounts are created by administrators. Deactivation removes access while retaining the
        audit history.
      </p>
      {editor && (
        <UserEditor
          key={editor === "new" ? "new" : editor.user_id}
          item={editor}
          selfId={user.user_id}
          onClose={() => setEditor(null)}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}{" "}
      {reset && <ResetPassword item={reset} onClose={() => setReset(null)} />}
      <AlertDialog
        open={!!toggle}
        onOpenChange={(open) => {
          if (!open && !mutating) setToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggle?.is_active ? "Deactivate this user?" : "Reactivate this user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggle?.is_active
                ? `${toggle.display_name} will lose access to RecallCam. Their previous work and audit records will be retained.`
                : `${toggle?.display_name} will regain access with their assigned role.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutating}>Cancel</AlertDialogCancel>
            <Button
              variant={toggle?.is_active ? "destructive" : "default"}
              disabled={mutating}
              onClick={() => void toggleStatus()}
            >
              {mutating ? "Updating…" : toggle?.is_active ? "Deactivate user" : "Reactivate user"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";
import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { FieldError, notifyError, PageHeading } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, errorFields, errorMessage } from "@/lib/api-client";
import { roleDescriptions, roleLabels } from "@/lib/types";
export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  if (!user) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFields({});
    setError("");
    const next = String(data.get("new_password"));
    if (next !== data.get("confirm_password")) {
      setFields({ confirm_password: "The passwords do not match." });
      toast.error("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(String(data.get("current_password")), next);
      signOut("Password changed. Sign in with your new password.");
    } catch (err) {
      setFields(errorFields(err));
      setError(errorMessage(err));
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Your account"
        description="Your workspace identity, access and sign-in security."
      />
      <div className="grid items-start gap-7 xl:grid-cols-[0.9fr_1.3fr]">
        <section className="panel p-7 sm:p-8">
          <div className="mb-7 flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-sage text-xl font-semibold text-sage-foreground">
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2 className="text-base font-semibold">{user.display_name}</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">Your workspace profile</p>
            </div>
          </div>
          <h3 className="flex items-center gap-2 border-t pt-6 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            Profile & access
          </h3>
          <dl className="mt-6 space-y-6 text-sm">
            <div>
              <dt className="text-muted-foreground">Display name</dt>
              <dd className="mt-2 font-medium">{user.display_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email address</dt>
              <dd className="mt-2 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="mt-2">
                <Badge variant="outline" className="bg-card">
                  {roleLabels[user.role]}
                </Badge>
                <p className="mt-3 max-w-md text-xs leading-6 text-muted-foreground">
                  {roleDescriptions[user.role]}
                </p>
              </dd>
            </div>
          </dl>
          <p className="mt-8 max-w-sm text-xs leading-6 text-muted-foreground">
            Your administrator manages your name and access permissions.
          </p>
        </section>
        <section className="panel p-7 sm:p-8">
          <h2 className="flex items-center gap-2.5 text-base font-semibold">
            <KeyRound className="size-5 text-primary" strokeWidth={1.5} />
            Change password
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            After saving, sign in again with your new password.
          </p>
          <form
            onSubmit={submit}
            onInvalid={() =>
              toast.error("Check the password requirements.", {
                id: "password-validation",
              })
            }
            className="mt-7 space-y-5"
          >
            {[
              {
                name: "current_password",
                label: "Current password",
                auto: "current-password",
                min: 1,
              },
              {
                name: "new_password",
                label: "New password",
                auto: "new-password",
                min: 12,
              },
              {
                name: "confirm_password",
                label: "Confirm new password",
                auto: "new-password",
                min: 12,
              },
            ].map((field) => (
              <div key={field.name} className="form-field">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete={field.auto}
                  minLength={field.min}
                  maxLength={128}
                  required
                  disabled={busy}
                  className="h-11 bg-card"
                  aria-invalid={!!fields[field.name]}
                />
                <FieldError message={fields[field.name]} />
                {field.name === "new_password" && (
                  <p className="field-help">Use between 12 and 128 characters.</p>
                )}
              </div>
            ))}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving password…" : "Update password"}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}

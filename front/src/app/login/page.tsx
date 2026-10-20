"use client";
import { Brand } from "@/components/brand";
import { EvidenceGraphic } from "@/components/evidence-graphic";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { FieldError } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorFields, errorMessage } from "@/lib/api-client";
import { toast } from "sonner";
export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")).trim(), String(data.get("password")));
    } catch (err) {
      setFields(errorFields(err));
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="grid min-h-screen bg-card lg:grid-cols-[1fr_1fr]">
      <section className="relative flex flex-col overflow-hidden bg-sidebar px-8 py-9 text-sidebar-foreground sm:px-12 lg:min-h-screen lg:px-14 lg:py-12 xl:px-20">
        <Brand light />
        <div className="mx-auto hidden w-full max-w-lg flex-1 flex-col justify-center py-12 lg:flex">
          <h2 className="max-w-md text-[40px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-5xl xl:text-[56px]">
            A clearer picture.
            <br />
            <span className="text-highlight">A stronger lead.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-sidebar-muted">
            Your video archive, understood in context. Find the moments that matter and follow the
            evidence behind them.
          </p>
          <div className="mt-8 hidden rounded-2xl border border-white/15 bg-white/[0.025] px-7 pb-6 pt-3 lg:block">
            <EvidenceGraphic light className="mx-auto max-w-[370px]" />
            <div className="flex justify-between gap-3 border-t border-white/10 pt-5 text-[11px] font-medium text-sidebar-muted">
              <span>Recorded footage</span>
              <span>Timeline context</span>
              <span className="text-highlight">Linked evidence</span>
            </div>
          </div>
        </div>
        <p className="hidden items-center gap-2 text-[11px] text-sidebar-muted lg:flex">
          <span className="size-1.5 rounded-full bg-highlight" />A shared archive. Access defined by
          your role.
        </p>
      </section>
      <section className="flex flex-col justify-between px-7 py-9 sm:px-12 lg:px-16">
        <p className="hidden text-right text-xs text-muted-foreground lg:block">
          Your investigation workspace
        </p>
        <div className="mx-auto w-full max-w-[380px] py-14 lg:py-16">
          <div className="mb-7 flex size-12 items-center justify-center rounded-xl border bg-muted/50">
            <ArrowRight className="size-5 text-primary" strokeWidth={1.6} />
          </div>
          <h1 className="text-[32px] font-semibold tracking-[-0.035em]">
            Welcome back<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Sign in with your workspace account to continue.
          </p>
          <form
            onSubmit={submit}
            onInvalid={() =>
              toast.error("Complete the required fields before signing in.", {
                id: "login-validation",
              })
            }
            className="mt-8 space-y-5"
          >
            <div className="form-field">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={320}
                placeholder="you@company.com"
                className="h-12 bg-card"
                required
                disabled={busy || loading}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? "email-error" : undefined}
              />
              <FieldError id="email-error" message={fields.email} />
            </div>
            <div className="form-field">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={128}
                  className="h-12 bg-card pr-12"
                  required
                  disabled={busy || loading}
                  aria-invalid={!!fields.password}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1.5 top-1.5 size-9"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <FieldError message={fields.password} />
            </div>
            {error && (
              <p className="text-sm leading-6 text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="mt-2 h-12 w-full justify-between px-5"
              disabled={busy || loading}
            >
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
          <p className="mt-7 border-t pt-6 text-xs leading-6 text-muted-foreground">
            Need an account or a password reset? Contact your administrator.
          </p>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          RecallCam · Video search & investigation
        </p>
      </section>
    </main>
  );
}

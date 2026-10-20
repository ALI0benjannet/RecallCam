"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronRight,
  FileClock,
  FileVideo,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LoadError } from "@/components/feedback";
import { roleLabels } from "@/lib/types";
import { cn } from "@/lib/utils";
const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { href: "/cameras", label: "Cameras", icon: Camera, group: "Workspace" },
  { href: "/library", label: "Recording library", icon: FileVideo, group: "Workspace" },
  { href: "/chat", label: "Investigate", icon: MessageSquare, group: "Workspace" },
  {
    href: "/upload",
    label: "Upload recordings",
    icon: Upload,
    permission: "videos:manage",
    group: "Management",
  },
  {
    href: "/admin/users",
    label: "Users & access",
    icon: Users,
    permission: "users:manage",
    group: "Management",
  },
  {
    href: "/audit",
    label: "Audit log",
    icon: FileClock,
    permission: "audit:read",
    group: "Management",
  },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, error, retry, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigationToggle = useRef<HTMLButtonElement>(null);
  const loginPage = pathname === "/login";
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!loading && !user && !error && !loginPage) router.replace("/login");
  }, [loading, user, error, loginPage, router]);
  if (loginPage) return <>{children}</>;
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <div role="status">
          <Brand />
          <p className="mt-5 text-center text-xs text-muted-foreground">Opening your workspace…</p>
        </div>
      </div>
    );
  if (error && !user)
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <LoadError message={error} retry={retry} />
        <Button className="mx-auto mt-2 block" variant="ghost" onClick={() => signOut()}>
          Return to sign in
        </Button>
      </main>
    );
  if (!user) return null;
  const required = pathname.startsWith("/admin")
    ? "users:manage"
    : pathname.startsWith("/audit")
      ? "audit:read"
      : pathname.startsWith("/upload")
        ? "videos:manage"
        : null;
  const forbidden = required && !user.permissions.includes(required);
  const current =
    links.find((link) => link.href === pathname)?.label ??
    (pathname === "/account" ? "Your account" : "Workspace");
  const sidebar = (
    <>
      <Link href="/" aria-label="RecallCam overview" className="mb-9 block px-3">
        <Brand light />
      </Link>
      <nav aria-label="Main navigation" className="space-y-7">
        {["Workspace", "Management"].map((group) => {
          const items = links.filter(
            (link) =>
              link.group === group &&
              (!link.permission || user.permissions.includes(link.permission)),
          );
          return items.length ? (
            <div key={group}>
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={cn("sidebar-link", pathname === link.href && "sidebar-link-active")}
                  >
                    <link.icon className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                    {link.label}
                    {pathname === link.href && (
                      <span className="ml-auto size-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ) : null;
        })}
      </nav>
      <div className="mt-auto pt-10">
        <div className="mx-1 mb-5 rounded-xl border border-white/10 p-4">
          <ShieldCheck className="mb-3 size-5 text-highlight" strokeWidth={1.5} />
          <p className="text-xs font-semibold text-sidebar-foreground">
            Evidence starts with context.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-muted">
            Keep each camera’s location and recording timezone accurate.
          </p>
        </div>
        <div className="border-t border-white/10 pt-3">
          <Link
            href="/account"
            onClick={() => setMobileOpen(false)}
            className={cn("sidebar-link", pathname === "/account" && "sidebar-link-active")}
          >
            <Settings2 className="size-[18px]" strokeWidth={1.7} />
            Account settings
          </Link>
          <button onClick={() => signOut()} className="sidebar-link w-full">
            <LogOut className="size-[18px]" strokeWidth={1.7} />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col overflow-y-auto bg-sidebar px-4 pb-5 pt-8 lg:flex">
        {sidebar}
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            navigationToggle.current?.focus();
          }}
          aria-describedby={undefined}
          className="inset-y-0 left-0 top-0 h-dvh max-h-none w-[min(310px,90vw)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 bg-sidebar p-5 pt-9 text-sidebar-foreground sm:max-w-none [&>button]:text-sidebar-foreground"
        >
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <div className="flex min-h-full flex-col">{sidebar}</div>
        </DialogContent>
      </Dialog>
      <div className="flex min-h-screen min-w-0 flex-col lg:ml-[252px]">
        <header className="flex h-[82px] shrink-0 items-center justify-between gap-4 border-b bg-card/80 px-5 sm:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              ref={navigationToggle}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5 text-xs">
              <Link href="/" className="hidden text-muted-foreground hover:text-primary sm:inline">
                Workspace
              </Link>
              <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
              <span className="truncate font-medium">{current}</span>
            </nav>
          </div>
          <Link
            href="/account"
            className="group flex shrink-0 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted"
          >
            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate text-xs font-semibold">{user.display_name}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{roleLabels[user.role]}</p>
            </div>
            <span
              className="grid size-9 place-items-center rounded-full bg-sage text-sm font-semibold text-sage-foreground"
              aria-hidden="true"
            >
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="sr-only">Your account</span>
          </Link>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1540px] flex-1 px-5 py-8 sm:px-8 xl:px-10 xl:py-10"
        >
          {forbidden ? (
            <div className="panel mx-auto max-w-xl p-8 sm:mt-12 sm:p-12">
              <ShieldCheck className="mb-6 size-9 text-primary" />
              <Badge variant="secondary" className="mb-5">
                Permission required
              </Badge>
              <h1 className="page-title">Access restricted</h1>
              <p className="page-description">
                Your role does not include this feature. Contact your administrator if you need
                access.
              </p>
              <Button asChild className="mt-7">
                <Link href="/">Back to overview</Link>
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="mx-5 flex flex-wrap items-center justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground sm:mx-8 xl:mx-10">
          <p>
            <span className="font-semibold text-foreground">RecallCam</span> · Video search &
            investigation
          </p>
          <p>Context. Clarity. Evidence.</p>
        </footer>
      </div>
    </div>
  );
}

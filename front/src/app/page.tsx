"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Camera as CameraIcon,
  FileClock,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EvidenceGraphic } from "@/components/evidence-graphic";
import {
  EmptyState,
  LoadError,
  LoadingRows,
  notifyError,
  PageHeading,
} from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/api-client";
import { roleDescriptions, roleLabels, type Camera, type Page } from "@/lib/types";
export default function HomePage() {
  const { user } = useAuth();
  const [cameras, setCameras] = useState<Page<Camera> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    setBusy(true);
    setError("");
    api
      .cameras(new URLSearchParams({ page: "1", page_size: "5", include_archived: "false" }))
      .then((result) => {
        if (active) setCameras(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(errorMessage(err));
          notifyError(err);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [user, revision]);
  if (!user) return null;
  const canManage = user.permissions.includes("cameras:manage");
  const shortcuts = [
    {
      href: "/account",
      title: "Account settings",
      description: "Your profile, role and password",
      icon: ShieldCheck,
    },
    ...(user.permissions.includes("users:manage")
      ? [
          {
            href: "/admin/users",
            title: "Users & access",
            description: "Manage your team’s workspace access",
            icon: Users,
          },
        ]
      : []),
    ...(user.permissions.includes("audit:read")
      ? [
          {
            href: "/audit",
            title: "Audit log",
            description: "Review account and camera activity",
            icon: FileClock,
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.display_name.trim().split(/\s+/)[0]}`}
        description="A clear view of your cameras, workspace and next steps."
        action={
          <Badge variant="outline" className="gap-1.5 bg-card px-3 py-1.5 font-medium">
            <ShieldCheck className="size-3.5" />
            {roleLabels[user.role]} workspace
          </Badge>
        }
      />
      <section
        className="mb-7 grid overflow-hidden rounded-2xl bg-sage md:grid-cols-[1.15fr_0.85fr]"
        aria-labelledby="workspace-start"
      >
        <div className="p-7 sm:p-9 lg:p-10">
          <h2
            id="workspace-start"
            className="max-w-md text-[28px] font-semibold leading-[1.3] tracking-[-0.035em] sm:text-[34px]"
          >
            Every investigation starts
            <br className="hidden sm:block" /> with the right context.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-sage-foreground">
            {canManage
              ? "Build your camera directory. Keep locations and recording timezones ready for the footage that follows."
              : "Explore your camera directory and keep your account ready for the footage that follows."}
          </p>
          <Button asChild className="mt-6">
            <Link href="/cameras">
              {canManage ? "Manage cameras" : "Explore cameras"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center border-t border-primary/10 px-8 py-5 md:border-l md:border-t-0">
          <EvidenceGraphic className="max-w-[350px]" />
        </div>
      </section>
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="panel min-w-0" aria-labelledby="camera-preview-heading">
          <div className="panel-header">
            <div>
              <h2 id="camera-preview-heading" className="panel-title">
                Camera directory
                {!busy && !error && cameras && (
                  <span className="ml-2.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {cameras.total}
                  </span>
                )}
              </h2>
              <p className="panel-description">Active cameras registered in your workspace</p>
            </div>
            <Link href="/cameras" className="subtle-link">
              View all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {busy ? (
            <LoadingRows label="Loading camera directory" />
          ) : error ? (
            <LoadError message={error} retry={reload} />
          ) : !cameras?.items.length ? (
            <EmptyState
              title="Give your footage a place to start"
              description={
                canManage
                  ? "Register a camera with its location and timezone. It will appear here when it’s ready."
                  : "Your administrator can register cameras for this shared workspace."
              }
              action={
                canManage ? (
                  <Button asChild variant="outline">
                    <Link href="/cameras">
                      <CameraIcon className="size-4" />
                      Set up your first camera
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y">
              {cameras.items.map((camera) => (
                <Link
                  key={camera.camera_id}
                  href="/cameras"
                  className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-muted/50"
                >
                  <span className="entity-icon">
                    <CameraIcon className="size-5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold group-hover:text-primary">
                      {camera.name}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">
                        {camera.location || "Location not specified"}
                      </span>
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className="status-pill status-pill-active">
                      <span className="status-dot" />
                      Active
                    </span>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">{camera.timezone}</p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside className="space-y-6">
          <section className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Workspace shortcuts</h2>
            </div>
            <div className="divide-y">
              {shortcuts.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className="group flex items-center gap-3.5 px-5 py-5 hover:bg-muted/50"
                >
                  <item.icon className="size-[18px] shrink-0 text-primary" strokeWidth={1.6} />
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <section className="mt-7 flex flex-col gap-5 rounded-xl border px-6 py-5 sm:flex-row sm:items-start">
        <ShieldCheck className="size-5 shrink-0 text-primary" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold">Your access, at a glance</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
            {roleDescriptions[user.role]}
          </p>
        </div>
        <Link href="/account" className="subtle-link shrink-0">
          View account
          <ArrowUpRight className="size-3.5" />
        </Link>
      </section>
      <p className="mt-5 text-[11px] leading-6 text-muted-foreground">
        Recording uploads and the library are available. Processing and evidence search are not
        connected yet.
      </p>
    </>
  );
}

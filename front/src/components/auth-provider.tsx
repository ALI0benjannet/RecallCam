"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, errorMessage, onUnauthorized, setAccessToken } from "@/lib/api-client";
import type { User } from "@/lib/types";

const storageKey = "recallcam.access";
type Auth = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (message?: string) => void;
  refreshUser: () => Promise<void>;
  retry: () => void;
};
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const generation = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const clear = useCallback(() => {
    generation.current += 1;
    setAccessToken(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A memory-only login remains usable. */
    }
    setUser(null);
    setExpiresAt(null);
    setError(null);
    setLoading(false);
  }, []);

  const expire = useCallback(() => {
    clear();
    toast.error("Your sign-in has expired. Sign in again to continue.", { id: "auth-expired" });
    router.replace("/login");
  }, [clear, router]);

  const restore = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    let saved: { token: string; expiresAt: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      clear();
    }
    if (!saved || typeof saved.token !== "string" || typeof saved.expiresAt !== "number") {
      clear();
      return;
    }
    if (saved.expiresAt <= Date.now()) {
      expire();
      return;
    }
    setAccessToken(saved.token);
    setExpiresAt(saved.expiresAt);
    try {
      const account = await api.me();
      if (current === generation.current) setUser(account);
    } catch (err) {
      if (current === generation.current && !(err instanceof ApiError && err.status === 401)) {
        const message = errorMessage(err);
        setError(message);
        toast.error(message, { id: "auth-connection" });
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [clear, expire]);

  const refreshUser = useCallback(async () => {
    const current = generation.current;
    try {
      const account = await api.me();
      if (current === generation.current) setUser(account);
    } catch (err) {
      if (current === generation.current && !(err instanceof ApiError && err.status === 401))
        toast.error(errorMessage(err), { id: "auth-connection" });
    }
  }, []);

  useEffect(() => {
    onUnauthorized(expire);
    void restore();
    return () => onUnauthorized(null);
  }, [expire, restore]);

  useEffect(() => {
    if (!expiresAt) return;
    const deadline = expiresAt;
    let timer: ReturnType<typeof window.setTimeout>;
    function schedule() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, [expiresAt, expire]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => void refreshUser();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUser();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, refreshUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const current = ++generation.current;
      const result = await api.login(email, password);
      if (current !== generation.current) return;
      const deadline = Date.now() + result.expires_in * 1000;
      setAccessToken(result.access_token);
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ token: result.access_token, expiresAt: deadline }),
        );
      } catch {
        toast.info(
          "Browser storage is unavailable. Refreshing this page will require signing in again.",
        );
      }
      setExpiresAt(deadline);
      setUser(result.user);
      setError(null);
      setLoading(false);
      toast.success(`Welcome back, ${result.user.display_name}.`);
      router.replace("/");
    },
    [router],
  );

  const signOut = useCallback(
    (message = "You have signed out.") => {
      clear();
      toast.success(message);
      router.replace("/login");
    },
    [clear, router],
  );

  return (
    <AuthContext.Provider
      value={{ user, loading, error, signIn, signOut, refreshUser, retry: () => void restore() }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

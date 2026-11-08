"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: AdminRole;
};

type AuthContextType = {
  user: AdminUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: AdminRole[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  canManageSettings: boolean;
  canManageTeam: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
  hasRole: () => false,
  isAdmin: false,
  isSuperAdmin: false,
  isManager: false,
  canManageSettings: false,
  canManageTeam: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${ROOT}/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 401) {
        setUser(null);
        if (pathname !== "/login") {
          router.replace("/login");
        }
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === "/login") {
      setLoading(false);
      return;
    }
    fetchSession();
  }, [fetchSession, pathname]);

  const logout = useCallback(async () => {
    try {
      await authenticatedFetch(`${ROOT}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const hasRole = useCallback(
    (...roles: AdminRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";
  const canManageSettings = isAdmin;
  const canManageTeam = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser: fetchSession,
        logout,
        hasRole,
        isAdmin,
        isSuperAdmin,
        isManager,
        canManageSettings,
        canManageTeam,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AuthContext);
}

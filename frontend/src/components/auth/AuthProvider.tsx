"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUser,
  loginAccount,
  logoutAccount,
  refreshAccount,
  registerAccount,
} from "@/lib/auth";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const refreshed = await refreshAccount();
    const currentUser = await getCurrentUser(refreshed.access_token);

    setAccessToken(refreshed.access_token);
    setUser(currentUser);
  }, []);

  useEffect(() => {
    refreshSession()
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [refreshSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginAccount(payload);
    setAccessToken(response.access_token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerAccount(payload);
    setAccessToken(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAccount();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isGuest: !user,
      isLoading,
      login,
      register,
      logout,
      refreshSession,
    }),
    [accessToken, isLoading, login, logout, refreshSession, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}

import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RefreshResponse,
  RegisterPayload,
} from "@/types/auth";
import { buildApiUrl } from "@/lib/apiConfig";

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String(body.detail)
        : `Request failed with ${response.status}`;
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export function registerAccount(payload: RegisterPayload) {
  return authRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: LoginPayload) {
  return authRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutAccount() {
  return authRequest<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}

export function refreshAccount() {
  return authRequest<RefreshResponse>("/auth/refresh", {
    method: "POST",
  });
}

export function getCurrentUser(accessToken: string) {
  return authRequest<AuthUser>("/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

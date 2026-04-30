import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RefreshResponse,
  RegisterPayload,
} from "@/types/auth";

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:8000";
  }

  return "http://127.0.0.1:8000";
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
  return authRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginAccount(payload: LoginPayload) {
  return authRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutAccount() {
  return authRequest<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export function refreshAccount() {
  return authRequest<RefreshResponse>("/api/auth/refresh", {
    method: "POST",
  });
}

export function getCurrentUser(accessToken: string) {
  return authRequest<AuthUser>("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

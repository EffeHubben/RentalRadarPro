import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RefreshResponse,
  RegisterPayload,
} from "@/types/auth";
import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";

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
    throw new Error(await getApiErrorMessage(response));
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

export function verifyEmailToken(token: string) {
  return authRequest<{ ok: boolean; message: string }>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
    },
  );
}

export function requestPasswordReset(email: string) {
  return authRequest<{ ok: boolean; message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, password: string) {
  return authRequest<{ ok: boolean; message: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function updateProfile(accessToken: string, payload: {
  display_name?: string;
  preferred_language?: "nl" | "en";
}) {
  return authRequest<{ ok: boolean; message: string }>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function changeEmailAddress(
  accessToken: string,
  payload: { new_email: string; current_password: string },
) {
  return authRequest<{ ok: boolean; message: string }>("/auth/change-email", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function changePassword(
  accessToken: string,
  payload: { current_password: string; new_password: string },
) {
  return authRequest<{ ok: boolean; message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

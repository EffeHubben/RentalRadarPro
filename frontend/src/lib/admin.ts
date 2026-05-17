import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";
import type {
  AdminAnalyticsLive,
  AdminAnalyticsOverview,
  AdminEmailDeliveryStatus,
  AdminEmailDeliveriesResponse,
  AdminHealth,
  AdminOverview,
  AdminScanHealthResponse,
  AdminScansResponse,
  AdminUserSegment,
  AdminSourcesResponse,
  AdminUser,
  AdminUsersResponse,
} from "@/types/admin";

async function adminRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function fetchAdminOverview(accessToken: string) {
  return adminRequest<AdminOverview>("/admin/overview", accessToken);
}

export function fetchAdminUsers(
  accessToken: string,
  options?: {
    limit?: number;
    search?: string;
    segment?: AdminUserSegment;
  },
) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.search?.trim()) {
    params.set("search", options.search.trim());
  }
  if (options?.segment && options.segment !== "all") {
    params.set("segment", options.segment);
  }

  return adminRequest<AdminUsersResponse>(`/admin/users?${params.toString()}`, accessToken);
}

export function updateAdminUserAdminStatus(
  accessToken: string,
  userId: number,
  isAdmin: boolean,
) {
  return adminRequest<AdminUser>(`/admin/users/${userId}/admin`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ is_admin: isAdmin }),
  });
}

export function updateAdminUserPlan(
  accessToken: string,
  userId: number,
  payload: {
    plan: "free" | "pro";
    expires_at?: string | null;
  },
) {
  return adminRequest<AdminUser>(`/admin/users/${userId}/plan`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUser(accessToken: string, userId: number) {
  return adminRequest<void>(`/admin/users/${userId}`, accessToken, {
    method: "DELETE",
  });
}

export function fetchAdminEmailDeliveries(
  accessToken: string,
  options?: {
    limit?: number;
    status?: AdminEmailDeliveryStatus;
    emailType?: string;
  },
) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.status && options.status !== "all") {
    params.set("status", options.status);
  }
  if (options?.emailType?.trim()) {
    params.set("email_type", options.emailType.trim());
  }

  return adminRequest<AdminEmailDeliveriesResponse>(
    `/admin/email-deliveries?${params.toString()}`,
    accessToken,
  );
}

export function fetchAdminSources(accessToken: string) {
  return adminRequest<AdminSourcesResponse>("/admin/sources", accessToken);
}

export type AdminCoverageEntry = { city?: string; source?: string; count: number };

export type AdminCoverageResponse = {
  listings_by_city: Array<{ city: string; count: number }>;
  listings_by_source: Array<{ source: string; count: number }>;
  failed_source_city_combos: Array<{
    source_id: string;
    city: string;
    status: string;
    count: number;
    last_finished_at: string | null;
  }>;
};

export function fetchAdminCoverage(accessToken: string) {
  return adminRequest<AdminCoverageResponse>("/admin/coverage", accessToken);
}

export function fetchAdminAnalyticsOverview(accessToken: string) {
  return adminRequest<AdminAnalyticsOverview>("/admin/analytics/overview", accessToken);
}

export function fetchAdminAnalyticsLive(accessToken: string) {
  return adminRequest<AdminAnalyticsLive>("/admin/analytics/live", accessToken);
}

export function fetchAdminHealth(accessToken: string) {
  return adminRequest<AdminHealth>("/admin/health", accessToken);
}

export function fetchAdminScans(
  accessToken: string,
  options?: { limit?: number; hours?: number; sourceId?: string; status?: string },
) {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  params.set("hours", String(options?.hours ?? 24));
  if (options?.sourceId) params.set("source_id", options.sourceId);
  if (options?.status) params.set("status", options.status);
  return adminRequest<AdminScansResponse>(`/admin/scans?${params.toString()}`, accessToken);
}

export function fetchAdminScanHealth(accessToken: string, hours = 24) {
  const params = new URLSearchParams({ hours: String(hours) });
  return adminRequest<AdminScanHealthResponse>(
    `/admin/scan-health?${params.toString()}`,
    accessToken,
  );
}

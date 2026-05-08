import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";
import type {
  AdminEmailDeliveriesResponse,
  AdminOverview,
  AdminSourcesResponse,
  AdminUsersResponse,
} from "@/types/admin";

async function adminRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export function fetchAdminOverview(accessToken: string) {
  return adminRequest<AdminOverview>("/admin/overview", accessToken);
}

export function fetchAdminUsers(accessToken: string, limit = 50) {
  return adminRequest<AdminUsersResponse>(`/admin/users?limit=${limit}`, accessToken);
}

export function fetchAdminEmailDeliveries(accessToken: string, limit = 50) {
  return adminRequest<AdminEmailDeliveriesResponse>(
    `/admin/email-deliveries?limit=${limit}`,
    accessToken,
  );
}

export function fetchAdminSources(accessToken: string) {
  return adminRequest<AdminSourcesResponse>("/admin/sources", accessToken);
}

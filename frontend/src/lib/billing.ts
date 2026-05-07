import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";

type BillingSessionResponse = {
  url: string;
};

type BillingConfigResponse = {
  billing_enabled: boolean;
};

async function billingRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
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

export function createCheckoutSession(accessToken: string) {
  return billingRequest<BillingSessionResponse>(
    "/billing/create-checkout-session",
    accessToken,
  );
}

export function createPortalSession(accessToken: string) {
  return billingRequest<BillingSessionResponse>(
    "/billing/create-portal-session",
    accessToken,
  );
}

export async function fetchBillingConfig() {
  const response = await fetch(buildApiUrl("/billing/config"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json() as Promise<BillingConfigResponse>;
}

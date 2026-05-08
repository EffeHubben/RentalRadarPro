import { useEffect, useState } from "react";
import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";
import {
  billingIntervalSuffix,
  formatMoneyFromMinorUnits,
  PRO_FALLBACK_CURRENCY,
  PRO_FALLBACK_INTERVAL,
  PRO_FALLBACK_MONTHLY_PRICE_CENTS,
} from "@/lib/pricing";
import type { Language } from "@/lib/i18n";

type BillingSessionResponse = {
  url: string;
};

type BillingConfigResponse = {
  billing_enabled: boolean;
  monthly_price_amount: number | null;
  monthly_price_currency: string | null;
  monthly_price_interval: string | null;
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

export async function createBillingSession(
  mode: "checkout" | "portal",
  accessToken: string,
) {
  return mode === "checkout"
    ? createCheckoutSession(accessToken)
    : createPortalSession(accessToken);
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

export function useBillingConfig() {
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [monthlyPriceAmount, setMonthlyPriceAmount] = useState<number | null>(null);
  const [monthlyPriceCurrency, setMonthlyPriceCurrency] = useState<string | null>(null);
  const [monthlyPriceInterval, setMonthlyPriceInterval] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchBillingConfig()
      .then((config) => {
        if (!cancelled) {
          setBillingEnabled(config.billing_enabled);
          setMonthlyPriceAmount(config.monthly_price_amount);
          setMonthlyPriceCurrency(config.monthly_price_currency);
          setMonthlyPriceInterval(config.monthly_price_interval);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBillingEnabled(false);
          setMonthlyPriceAmount(null);
          setMonthlyPriceCurrency(null);
          setMonthlyPriceInterval(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    billingEnabled,
    monthlyPriceAmount,
    monthlyPriceCurrency,
    monthlyPriceInterval,
  };
}

export function formatProPlanPrice(
  language: Language,
  priceAmount: number | null,
  priceCurrency: string | null,
) {
  return formatMoneyFromMinorUnits(
    priceAmount ?? PRO_FALLBACK_MONTHLY_PRICE_CENTS,
    priceCurrency ?? PRO_FALLBACK_CURRENCY,
    language,
  );
}

export function formatProPlanPriceSuffix(language: Language, interval: string | null) {
  return billingIntervalSuffix(interval ?? PRO_FALLBACK_INTERVAL, language);
}

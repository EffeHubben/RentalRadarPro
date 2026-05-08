import type { Language } from "@/lib/i18n";

export const PRO_FALLBACK_MONTHLY_PRICE_CENTS = 1999;
export const PRO_FALLBACK_CURRENCY = "eur";
export const PRO_FALLBACK_INTERVAL = "month";

export function formatMoneyFromMinorUnits(
  amount: number,
  currency: string,
  language: Language,
) {
  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function billingIntervalSuffix(interval: string | null | undefined, language: Language) {
  if (interval === "month") {
    return language === "nl" ? "/ maand" : "/ month";
  }

  if (interval === "year") {
    return language === "nl" ? "/ jaar" : "/ year";
  }

  return "";
}

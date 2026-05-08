import type { Language } from "@/lib/i18n";
import type { AuthUser } from "@/types/auth";

export function hasPro(user: AuthUser | null): boolean {
  return (
    user?.plan === "pro" &&
    (user.subscription_status === "active" || user.subscription_status === "trialing")
  );
}

export function formatAccountDate(value: string | null, language: Language) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function describeSubscriptionState(user: AuthUser | null, language: Language) {
  if (!user) {
    return null;
  }

  const currentPeriodEnd = formatAccountDate(user.subscription_current_period_end, language);

  if (user.plan === "pro" && user.subscription_status === "active") {
    if (user.subscription_cancel_at_period_end && currentPeriodEnd) {
      return language === "nl"
        ? `Abonnement opgezegd — Pro-toegang blijft tot ${currentPeriodEnd}`
        : `Subscription canceled — Pro access remains until ${currentPeriodEnd}`;
    }

    if (currentPeriodEnd) {
      return language === "nl"
        ? `Verlengt op ${currentPeriodEnd}`
        : `Renews on ${currentPeriodEnd}`;
    }
  }

  if (user.plan === "pro" && user.subscription_status === "trialing" && currentPeriodEnd) {
    return language === "nl"
      ? `Pro-toegang actief tot ${currentPeriodEnd}`
      : `Access active until ${currentPeriodEnd}`;
  }

  if (currentPeriodEnd && (user.subscription_status === "canceled" || user.subscription_status === "inactive")) {
    return language === "nl"
      ? `Toegang actief tot ${currentPeriodEnd}`
      : `Access active until ${currentPeriodEnd}`;
  }

  if (user.subscription_status === "past_due") {
    return language === "nl"
      ? "Betaling mislukt — werk je betaalmethode bij om Pro te behouden"
      : "Payment failed — update your payment method to keep Pro access";
  }

  return language === "nl" ? "Gratis account actief" : "Free plan active";
}

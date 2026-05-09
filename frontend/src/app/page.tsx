"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  createBillingSession,
  formatProPlanPrice,
  formatProPlanPriceSuffix,
  useBillingConfig,
} from "@/lib/billing";
import { hasPro } from "@/lib/subscription";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import { CinematicLanding } from "@/components/landing/CinematicLanding";

const onboardingStorageKey = "rental-radar-onboarding-complete-v1";
type AuthMode = "login" | "register";
type BillingMode = "checkout" | "portal";

export default function HomePage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const [hasPreviousSearch, setHasPreviousSearch] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthMode>("register");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [pendingBillingMode, setPendingBillingMode] = useState<BillingMode | null>(null);
  const {
    billingEnabled,
    monthlyPriceAmount,
    monthlyPriceCurrency,
    monthlyPriceInterval,
  } = useBillingConfig();
  const copy = i18n[language].home;
  const isPro = hasPro(auth.user);

  useEffect(() => {
    setHasPreviousSearch(window.localStorage.getItem(onboardingStorageKey) === "done");
  }, []);

  function openAuth(mode: AuthMode) {
    setModalMode(mode);
    setModalOpen(true);
  }

  function closeAuth() {
    setModalOpen(false);
    setPendingBillingMode(null);
  }

  async function startBillingFlow(mode: BillingMode) {
    setBillingError("");

    if (!billingEnabled) {
      setBillingError(copy.billingUnavailable);
      return;
    }

    if (!auth.isAuthenticated || !auth.accessToken) {
      setPendingBillingMode(mode);
      openAuth(mode === "checkout" ? "register" : "login");
      return;
    }

    setBillingLoading(true);

    try {
      const session = await createBillingSession(mode, auth.accessToken);
      window.location.assign(session.url);
    } catch (caughtError) {
      setBillingError(
        caughtError instanceof Error ? caughtError.message : copy.billingGenericError,
      );
    } finally {
      setBillingLoading(false);
    }
  }

  function handleAuthenticated() {
    if (!pendingBillingMode) return;
    const nextMode = pendingBillingMode;
    setPendingBillingMode(null);
    void startBillingFlow(nextMode);
  }

  const proPlanBadge = !billingEnabled
    ? copy.proPlanComingSoon
    : isPro
      ? copy.proPlanCurrentPlan
      : copy.proPlanBadge;

  const proPlanButtonLabel = !billingEnabled
    ? copy.proPlanComingSoon
    : !auth.isAuthenticated || !auth.accessToken
      ? copy.proPlanGuestCta
      : isPro
        ? copy.proPlanManageCta
        : copy.proPlanCta;

  const proPlanButtonMode: BillingMode = isPro ? "portal" : "checkout";

  const proPlanPrice = billingEnabled
    ? formatProPlanPrice(language, monthlyPriceAmount, monthlyPriceCurrency)
    : copy.proPlanComingSoon;

  const proPlanPriceSuffix = billingEnabled
    ? formatProPlanPriceSuffix(language, monthlyPriceInterval)
    : "";

  const freePlanButtonLabel = !auth.isAuthenticated
    ? copy.startSearch
    : isPro
      ? copy.startSearchPro
      : copy.proPlanCta;

  const heroPrimaryLabel = !auth.isAuthenticated
    ? copy.startSearch
    : isPro
      ? copy.startSearchPro
      : copy.proPlanCta;

  const finalCtaLabel = !auth.isAuthenticated
    ? copy.startSearch
    : isPro
      ? copy.startSearchPro
      : copy.proPlanCta;

  const finalCtaHref = !auth.isAuthenticated || isPro ? "/search" : undefined;

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <CinematicLanding
        language={language}
        isPro={isPro}
        isAuthenticated={auth.isAuthenticated}
        hasPreviousSearch={hasPreviousSearch}
        billingEnabled={billingEnabled}
        billingLoading={billingLoading}
        billingError={billingError}
        proPlanPrice={proPlanPrice}
        proPlanPriceSuffix={proPlanPriceSuffix}
        proPlanBadge={proPlanBadge}
        proPlanButtonLabel={proPlanButtonLabel}
        proPlanButtonMode={proPlanButtonMode}
        freePlanButtonLabel={freePlanButtonLabel}
        heroPrimaryLabel={heroPrimaryLabel}
        finalCtaLabel={finalCtaLabel}
        finalCtaHref={finalCtaHref}
        onHeroPrimary={
          !auth.isAuthenticated
            ? () => openAuth("register")
            : isPro
              ? () => window.location.assign("/search")
              : () => void startBillingFlow("checkout")
        }
        onFreePlan={
          !auth.isAuthenticated
            ? () => openAuth("register")
            : isPro
              ? () => window.location.assign("/search")
              : () => void startBillingFlow("checkout")
        }
        onStartBilling={(mode) => void startBillingFlow(mode)}
        onFinalCta={
          !auth.isAuthenticated
            ? () => openAuth("register")
            : isPro
              ? () => window.location.assign("/search")
              : () => void startBillingFlow("checkout")
        }
      />

      <SiteFooter language={language} />

      <AuthModal
        open={modalOpen}
        initialMode={modalMode}
        language={language}
        onClose={closeAuth}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}

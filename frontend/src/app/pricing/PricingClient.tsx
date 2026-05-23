"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { languageRecord } from "@/components/site/InfoPageLayout";
import {
  createPaddleCheckout,
  getPaymentProvider,
  type PaddlePlan,
} from "@/lib/billing";
import type { Language } from "@/lib/i18n";
import {
  openPaddleCheckout,
  PaddleLoadError,
  PaddleNotConfiguredError,
} from "@/lib/paddle";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Abonnementen",
    title: "Eenvoudig beginnen, altijd gratis.",
    intro:
      "Start gratis en upgrade naar Pro wanneer je meer nodig hebt. RentScout Pro is een tijdelijke Pro-pas voor serieuze woningzoekers.",
    freePlanName: "Gratis",
    freePlanPrice: "€0",
    freePlanPriceSuffix: "voor altijd",
    freePlanDescription: "Alles wat je nodig hebt om te beginnen.",
    freePlanFeatures: [
      "Beperkt overzicht van huurwoningadvertenties",
      "Basiszoekfilters",
      "Maximaal 10 zichtbare advertenties",
    ],
    freeCta: "Gratis zoeken",
    proPassesTitle: "Kies je Pro-pas",
    proPassesIntro:
      "Eenmalige betaling. Geen abonnement. Je Pro-toegang stopt automatisch.",
    plan1mTitle: "1 maand Pro",
    plan2mTitle: "2 maanden Pro",
    plan3mTitle: "3 maanden Pro",
    plan1mPrice: "€14,99",
    plan2mPrice: "€24,99",
    plan3mPrice: "€34,99",
    plan1mInterval: "eenmalig",
    plan2mInterval: "eenmalig",
    plan3mInterval: "eenmalig",
    plan2mSave: "Bespaar €4,99",
    plan3mSave: "Bespaar €9,98",
    plan3mBadge: "Beste deal",
    plan1mCta: "Kies 1 maand",
    plan2mCta: "Kies 2 maanden",
    plan3mCta: "Kies 3 maanden",
    oneTimeNote: "Eenmalige betaling — geen abonnement, stopt automatisch.",
    idealNote: "Betaal veilig met iDEAL, creditcard of PayPal.",
    billingNote: "Betalingen worden veilig verwerkt via Paddle.",
    loginRequired: "Log in of maak een account om Pro te activeren.",
    loadingCheckout: "Checkout openen...",
    checkoutFailed: "Het is niet gelukt om de Paddle-checkout te openen.",
    checkoutNotConfigured: "Paddle is niet correct geconfigureerd. Probeer het later opnieuw.",
    paddleSectionEyebrow: "RentScout Pro",
    paddleSectionTitle: "Kies hoe lang je Pro wilt",
    paddleSectionSubtitle:
      "Eenmalige betaling. Geen abonnement. Geen verrassingen — je toegang stopt automatisch.",
    paddlePerMonth: "per maand",
    paddleIncludedTitle: "Alles in Pro",
    paddleIncluded: [
      "Volledige advertentiedetails en directe links",
      "Meer resultaten per zoekopdracht",
      "Geavanceerde zoekfilters",
      "Opgeslagen zoekprofielen",
      "Workflow- en statustracking per woning",
      "Verbergt advertenties die je al hebt gezien",
    ],
    trustTitle: "Betaal veilig",
    trustItems: ["iDEAL", "Creditcard", "PayPal", "Apple Pay"],
    moneyBack: "Geen automatische verlenging. Geen creditcard onthouden.",
    proPlanName: "Pro",
    proPlanPrice: "€19,99",
    proPlanPriceSuffix: "/ maand",
    proPlanDescription: "Meer kracht voor een serieuze huurwoningzoektocht.",
    proPlanSubtitle: "Digitaal SaaS-abonnement — RentScout Pro",
    proPlanFeatures: [
      "Volledige advertentiedetails",
      "Meer resultaten per zoekopdracht",
      "Geavanceerde zoekfilters",
      "Opgeslagen zoekprofielen",
      "Workflow en statustracking per woning",
    ],
    proCta: "Upgraden naar Pro",
    faqTitle: "Veelgestelde vragen",
    faq: [
      {
        q: "Wat is inbegrepen bij het gratis abonnement?",
        a: "Het gratis abonnement geeft toegang tot een beperkt overzicht van huurwoningadvertenties, basisfilters en maximaal 10 zichtbare advertenties.",
      },
      {
        q: "Wat krijg ik extra met Pro?",
        a: "Pro geeft volledige toegang tot advertentiedetails, meer resultaten, geavanceerde filters, opgeslagen zoekprofielen en workflow- en statustracking per woning.",
      },
      {
        q: "Hoe werkt een Pro-pas?",
        a: "Een Pro-pas is een eenmalige betaling. Na een succesvolle betaling krijg je 1, 2 of 3 maanden Pro-toegang. Daarna stopt je Pro-toegang automatisch — je hoeft niets op te zeggen.",
      },
      {
        q: "Wie verwerkt de betaling?",
        a: "Betalingen voor RentScout Pro worden verwerkt door Paddle. RentScout bewaart zelf geen volledige betaalgegevens.",
      },
    ],
  },
  {
    eyebrow: "Plans",
    title: "Start for free, always.",
    intro:
      "Begin for free and upgrade to Pro when you need more. RentScout Pro is a temporary Pro pass for serious renters.",
    freePlanName: "Free",
    freePlanPrice: "€0",
    freePlanPriceSuffix: "forever",
    freePlanDescription: "Everything you need to get started.",
    freePlanFeatures: [
      "Limited preview of rental listings",
      "Basic search filters",
      "Up to 10 visible listings",
    ],
    freeCta: "Start for free",
    proPassesTitle: "Choose your Pro pass",
    proPassesIntro:
      "One-time payment. No subscription. Your Pro access ends automatically.",
    plan1mTitle: "1 month Pro",
    plan2mTitle: "2 months Pro",
    plan3mTitle: "3 months Pro",
    plan1mPrice: "€14.99",
    plan2mPrice: "€24.99",
    plan3mPrice: "€34.99",
    plan1mInterval: "one-time",
    plan2mInterval: "one-time",
    plan3mInterval: "one-time",
    plan2mSave: "Save €4.99",
    plan3mSave: "Save €9.98",
    plan3mBadge: "Best deal",
    plan1mCta: "Choose 1 month",
    plan2mCta: "Choose 2 months",
    plan3mCta: "Choose 3 months",
    oneTimeNote: "One-time payment — no subscription, ends automatically.",
    idealNote: "Pay securely with iDEAL, credit card, or PayPal.",
    billingNote: "Payments are processed securely through Paddle.",
    loginRequired: "Log in or create an account to activate Pro.",
    loadingCheckout: "Opening checkout...",
    checkoutFailed: "Could not open Paddle checkout.",
    checkoutNotConfigured: "Paddle is not configured correctly. Please try again later.",
    paddleSectionEyebrow: "RentScout Pro",
    paddleSectionTitle: "Pick how long you want Pro",
    paddleSectionSubtitle:
      "One-time payment. No subscription. No surprises — access ends automatically.",
    paddlePerMonth: "per month",
    paddleIncludedTitle: "Everything in Pro",
    paddleIncluded: [
      "Full listing details and direct links",
      "More results per search",
      "Advanced search filters",
      "Saved search profiles",
      "Workflow and status tracking per listing",
      "Hides listings you've already seen",
    ],
    trustTitle: "Pay securely",
    trustItems: ["iDEAL", "Credit card", "PayPal", "Apple Pay"],
    moneyBack: "No auto-renewal. No saved card on file.",
    proPlanName: "Pro",
    proPlanPrice: "€19.99",
    proPlanPriceSuffix: "/ month",
    proPlanDescription: "More power for a serious rental search.",
    proPlanSubtitle: "Digital SaaS subscription — RentScout Pro",
    proPlanFeatures: [
      "Full listing details",
      "More results per search",
      "Advanced search filters",
      "Saved search profiles",
      "Rental workflow and status tracking",
    ],
    proCta: "Upgrade to Pro",
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "What is included in the free plan?",
        a: "The free plan gives access to a limited preview of rental listings, basic filters, and up to 10 visible listings.",
      },
      {
        q: "What do I get with Pro?",
        a: "Pro gives full access to listing details, more results, advanced filters, saved search profiles, and workflow or status tracking per listing.",
      },
      {
        q: "How does a Pro pass work?",
        a: "A Pro pass is a one-time payment. After a successful payment you get 1, 2, or 3 months of Pro access. After that, Pro access ends automatically — there is nothing to cancel.",
      },
      {
        q: "Who handles the payment?",
        a: "Payments for RentScout Pro are processed by Paddle. RentScout does not store full payment details itself.",
      },
    ],
  },
);

type PaddlePassCardProps = {
  title: string;
  price: string;
  perMonth: string;
  perMonthLabel: string;
  intervalLabel: string;
  cta: string;
  saveLabel?: string;
  topBadge?: string;
  highlight?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
};

function PaddlePassCard({
  title,
  price,
  perMonth,
  perMonthLabel,
  intervalLabel,
  cta,
  saveLabel,
  topBadge,
  highlight,
  loading,
  disabled,
  onClick,
}: PaddlePassCardProps) {
  return (
    <div
      className={`group relative flex h-full flex-col rounded-[1.5rem] p-6 transition-transform duration-300 ${
        highlight
          ? "border-2 border-brass/60 bg-[var(--color-surface-elevated)] shadow-[0_24px_60px_-20px_rgba(215,168,79,0.45)] sm:scale-[1.03] sm:hover:-translate-y-1"
          : "border border-[var(--color-border)] bg-[var(--color-surface)] hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.18)]"
      }`}
    >
      {topBadge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink shadow-[0_6px_18px_rgba(215,168,79,0.32)]">
            <span aria-hidden="true">★</span>
            {topBadge}
          </span>
        </div>
      ) : null}

      <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold tracking-tight text-[var(--color-text)]">{price}</span>
        <span className="text-sm text-[var(--color-muted)]">{intervalLabel}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--color-muted)]">
        <span>
          <span className="font-semibold text-[var(--color-text)]">{perMonth}</span> {perMonthLabel}
        </span>
        {saveLabel ? (
          <span className="rounded-full bg-[var(--color-teal-soft)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--color-teal)]">
            {saveLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={
            highlight
              ? "inline-flex h-12 w-full items-center justify-center rounded-lg border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.32)] transition hover:bg-brass/90 hover:shadow-[0_16px_34px_rgba(215,168,79,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
              : "rs-primary-button inline-flex h-12 w-full items-center justify-center rounded-lg px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {loading ? "..." : cta}
        </button>
      </div>
    </div>
  );
}

function TrustIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
      {label}
    </span>
  );
}

export default function PricingClient() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const c = copy[language as Language];
  const provider = getPaymentProvider();
  const [loadingPlan, setLoadingPlan] = useState<PaddlePlan | null>(null);
  const [error, setError] = useState("");

  async function handlePaddleCheckout(plan: PaddlePlan) {
    if (loadingPlan !== null) {
      return;
    }

    setError("");

    if (!auth.isAuthenticated || !auth.accessToken) {
      setError(c.loginRequired);
      return;
    }

    setLoadingPlan(plan);
    try {
      const session = await createPaddleCheckout(plan, auth.accessToken);
      await openPaddleCheckout(session.transaction_id);
    } catch (caughtError) {
      if (caughtError instanceof PaddleNotConfiguredError) {
        console.error("paddle.checkout.not_configured");
        setError(c.checkoutNotConfigured);
      } else if (caughtError instanceof PaddleLoadError) {
        console.error("paddle.checkout.load_failed", caughtError.message);
        setError(c.checkoutFailed);
      } else {
        console.error(
          "paddle.checkout.unexpected_error",
          caughtError instanceof Error ? caughtError.message : caughtError,
        );
        setError(
          caughtError instanceof Error ? caughtError.message : c.checkoutFailed,
        );
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {c.eyebrow}
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.06] sm:text-5xl">
              {c.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {c.intro}
            </p>
          </div>
        </section>

        {provider === "paddle" ? (
          <>
            <section className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-[1]"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-hero-glow), transparent 70%)",
                }}
              />
              <div className="mx-auto max-w-7xl px-4 pt-12 pb-6 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                  <p className="inline-flex rounded-full border border-brass/30 bg-brass/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-strong)]">
                    {c.paddleSectionEyebrow}
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {c.paddleSectionTitle}
                  </h2>
                  <p className="mt-3 text-base leading-7 text-[var(--color-muted)]">
                    {c.paddleSectionSubtitle}
                  </p>
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
              <div className="mx-auto grid max-w-5xl gap-6 pt-6 sm:grid-cols-3 sm:gap-5">
                <PaddlePassCard
                  title={c.plan1mTitle}
                  price={c.plan1mPrice}
                  perMonth={c.plan1mPrice}
                  perMonthLabel={c.paddlePerMonth}
                  intervalLabel={c.plan1mInterval}
                  cta={c.plan1mCta}
                  loading={loadingPlan === "1m"}
                  disabled={loadingPlan !== null}
                  onClick={() => void handlePaddleCheckout("1m")}
                />
                <PaddlePassCard
                  title={c.plan2mTitle}
                  price={c.plan2mPrice}
                  perMonth={language === "nl" ? "€12,50" : "€12.50"}
                  perMonthLabel={c.paddlePerMonth}
                  intervalLabel={c.plan2mInterval}
                  cta={c.plan2mCta}
                  saveLabel={c.plan2mSave}
                  loading={loadingPlan === "2m"}
                  disabled={loadingPlan !== null}
                  onClick={() => void handlePaddleCheckout("2m")}
                />
                <PaddlePassCard
                  title={c.plan3mTitle}
                  price={c.plan3mPrice}
                  perMonth={language === "nl" ? "€11,66" : "€11.66"}
                  perMonthLabel={c.paddlePerMonth}
                  intervalLabel={c.plan3mInterval}
                  cta={c.plan3mCta}
                  topBadge={c.plan3mBadge}
                  saveLabel={c.plan3mSave}
                  highlight
                  loading={loadingPlan === "3m"}
                  disabled={loadingPlan !== null}
                  onClick={() => void handlePaddleCheckout("3m")}
                />
              </div>

              {error ? (
                <p className="mx-auto mt-5 max-w-3xl text-center text-sm text-danger">{error}</p>
              ) : null}

              <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  {c.trustTitle}
                </span>
                {c.trustItems.map((item) => (
                  <TrustIcon key={item} label={item} />
                ))}
              </div>
              <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-[var(--color-muted)]">
                {c.moneyBack} · {c.billingNote}
              </p>

              <div className="mx-auto mt-12 grid max-w-5xl gap-6 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:grid-cols-[1.1fr_0.9fr] sm:p-8">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    {c.paddleIncludedTitle}
                  </h3>
                  <ul className="mt-5 grid gap-2.5">
                    {c.paddleIncluded.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm leading-6 text-[var(--color-muted)]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal-soft)] text-[0.7rem] font-bold text-[var(--color-teal)]"
                        >
                          ✓
                        </span>
                        <span className="text-[var(--color-text)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-soft)] p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[var(--color-text)]">
                      {c.freePlanName}
                    </h3>
                    <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">
                      {c.freePlanPriceSuffix}
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-bold text-[var(--color-text)]">
                      {c.freePlanPrice}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {c.freePlanDescription}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {c.freePlanFeatures.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-[var(--color-muted)]"
                      >
                        <span className="mt-0.5 shrink-0 text-[var(--color-teal)]">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/search"
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-border-strong)]"
                  >
                    {c.freeCta}
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
              <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{c.freePlanName}</h2>
                  <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">{c.freePlanName}</span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{c.freePlanPrice}</span>
                  <span className="ml-2 text-sm text-[var(--color-muted)]">{c.freePlanPriceSuffix}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{c.freePlanDescription}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {c.freePlanFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                      <span className="mt-0.5 shrink-0 text-[var(--color-teal)]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/search"
                  className="rs-primary-button mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold"
                >
                  {c.freeCta}
                </Link>
              </div>

              <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-premium)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{c.proPlanName}</h2>
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)]">
                    Pro
                  </span>
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-bold">{c.proPlanPrice}</span>
                  <span className="text-sm text-[var(--color-muted)]">{c.proPlanPriceSuffix}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{c.proPlanDescription}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{c.proPlanSubtitle}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {c.proPlanFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                      <span className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/account"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.24)] transition hover:bg-brass/90 hover:shadow-[0_16px_34px_rgba(215,168,79,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-elevated)]"
                >
                  {c.proCta}
                </Link>
                <p className="mt-4 text-xs leading-5 text-[var(--color-muted)]">{c.billingNote}</p>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-[var(--color-border)] bg-[var(--color-band)]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold">{c.faqTitle}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {c.faq.map((item) => (
                <div key={item.q} className="rs-card rounded-[1.5rem] p-6">
                  <h3 className="text-sm font-semibold">{item.q}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter language={language} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ScrollVideoSection } from "@/components/landing/ScrollVideoSection";
import {
  createBillingSession,
  formatProPlanPrice,
  formatProPlanPriceSuffix,
  useBillingConfig,
} from "@/lib/billing";
import { hasPro } from "@/lib/subscription";
import { i18n, type Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";


const onboardingStorageKey = "rental-radar-onboarding-complete-v1";
type AuthMode = "login" | "register";
type BillingMode = "checkout" | "portal";

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function ProductPreview({ language }: { language: Language }) {
  const shouldReduceMotion = useReducedMotion();
  const copy = i18n[language].home;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 }}
      className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-premium)]"
    >
      <div className="rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">
              {copy.previewProfileTitle}
            </div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              {copy.previewProfileMeta}
            </div>
          </div>
          <span className="rounded-full bg-[var(--color-teal-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-teal)]">
            {copy.previewMatchCount}
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {copy.previewListings.map((listing, index) => (
            <motion.article
              key={listing.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.18 + index * 0.08 }}
              whileHover={shouldReduceMotion ? undefined : { y: -4 }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {listing.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{listing.meta}</p>
                </div>
                <div className="text-right text-sm font-semibold text-[var(--color-text)]">
                  {listing.price}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--color-subtle)]">{copy.previewSources}</span>
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent-strong)]">
                  {listing.label}
                </span>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">
                {copy.previewSavedSearchTitle}
              </div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                {copy.previewSavedSearchMeta}
              </div>
            </div>
            <motion.span
              animate={shouldReduceMotion ? undefined : { opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-full bg-[var(--color-teal-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-teal)]"
            >
              {copy.previewLiveBadge}
            </motion.span>
          </div>
          <div className="mt-4 space-y-3">
            {copy.searchSignals.map((signal, index) => (
              <div key={signal.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)]">{signal.label}</span>
                  <span className="font-semibold text-[var(--color-text)]">{signal.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    initial={shouldReduceMotion ? false : { width: 0 }}
                    animate={{ width: signal.width }}
                    transition={{ duration: 0.7, delay: 0.35 + index * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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
    if (!pendingBillingMode) {
      return;
    }

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
  const freePlanButtonAction = !auth.isAuthenticated
    ? () => openAuth("register")
    : isPro
      ? () => window.location.assign("/search")
      : () => void startBillingFlow("checkout");
  const heroPrimaryLabel = !auth.isAuthenticated
    ? copy.startSearch
    : isPro
      ? copy.startSearchPro
      : copy.proPlanCta;
  const heroPrimaryAction = !auth.isAuthenticated
    ? () => openAuth("register")
    : isPro
      ? () => window.location.assign("/search")
      : () => void startBillingFlow("checkout");
  const finalCtaLabel = !auth.isAuthenticated
    ? copy.startSearch
    : isPro
      ? copy.startSearchPro
      : copy.proPlanCta;
  const finalCtaHref = !auth.isAuthenticated || isPro ? "/search" : undefined;
  const finalCtaAction = !auth.isAuthenticated
    ? () => openAuth("register")
    : isPro
      ? () => window.location.assign("/search")
      : () => void startBillingFlow("checkout");

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        {/* Hero — video background, centered content */}
        <section className="relative flex min-h-[100dvh] items-center overflow-hidden sm:min-h-[620px]">
          {/* Video backgrounds — cover on mobile (no white bars), contain on desktop */}
          <video
            className="hero-video-light absolute inset-0 h-full w-full object-cover sm:object-contain"
            src="/videos/rotation.house.white.pingpong.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <video
            className="hero-video-dark absolute inset-0 h-full w-full object-cover sm:object-contain"
            src="/videos/rotation.house.dark.pingpong.mp4"
            autoPlay
            muted
            loop
            playsInline
          />

          {/* Inward masking */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[18%] sm:w-[32%]" style={{ background: "linear-gradient(to right, var(--color-page), transparent)" }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[18%] sm:w-[32%]" style={{ background: "linear-gradient(to left, var(--color-page), transparent)" }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[18%] sm:h-[26%]" style={{ background: "linear-gradient(to bottom, var(--color-page), transparent)" }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[18%] sm:h-[26%]" style={{ background: "linear-gradient(to top, var(--color-page), transparent)" }} />

          {/* Center veil */}
          <div className="hero-center-veil pointer-events-none absolute inset-0 z-[2]" />

          {/* Warm glow */}
          <div className="animate-warm-drift pointer-events-none absolute inset-x-0 top-0 z-[3] h-48 sm:h-64 bg-[radial-gradient(circle_at_50%_20%,var(--color-hero-glow),transparent_34rem)]" />

          {/* Centered content */}
          <div className="relative z-[10] mx-auto w-full max-w-3xl px-5 py-20 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
            <motion.p
              className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {copy.eyebrow}
            </motion.p>
            <motion.h1
              className="mt-5 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.01em] text-[var(--color-text)] sm:text-5xl lg:text-6xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              {copy.title}
            </motion.h1>
            <motion.p
              className="mx-auto mt-5 max-w-sm text-[0.95rem] leading-7 text-[var(--color-muted)] sm:max-w-xl sm:text-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              {copy.subtitle}
            </motion.p>

            <motion.div
              className="mt-7 flex flex-wrap justify-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <button
                type="button"
                onClick={heroPrimaryAction}
                className="rs-primary-button inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold sm:h-12"
              >
                {heroPrimaryLabel}
              </button>
              {!auth.isAuthenticated && !hasPreviousSearch ? (
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-border-strong)] sm:h-12"
                >
                  {copy.startSearchNoAccount}
                </Link>
              ) : hasPreviousSearch ? (
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-border-strong)] sm:h-12"
                >
                  {copy.continueSearch}
                </Link>
              ) : (
                <a
                  href="#pricing"
                  className="inline-flex h-11 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:border-[var(--color-border-strong)] sm:h-12"
                >
                  {copy.viewPlans}
                </a>
              )}
            </motion.div>

            <motion.div
              className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:gap-x-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.22 }}
            >
              {copy.productHighlights.map((highlight) => (
                <span key={highlight} className="text-sm leading-6 text-[var(--color-muted)]">
                  <span className="mr-2 text-[var(--color-accent-strong)]">•</span>
                  {highlight}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Scroll-driven video section */}
        <ScrollVideoSection language={language} />

        {/* Product preview — shown below hero */}
        <section className="mx-auto max-w-2xl px-4 pb-16 sm:px-6 lg:px-8">
          <ProductPreview language={language} />
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-band)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <Reveal>
              <div className="grid gap-8 lg:grid-cols-[0.45fr_1fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
                    {copy.stepsTitle}
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight text-[var(--color-text)]">
                    {copy.journeyTitle}
                  </h2>
                </div>

                <div className="relative grid gap-6">
                  <div className="absolute left-[1.18rem] top-8 hidden h-[calc(100%-4rem)] w-px bg-[var(--color-border)] sm:block" />
                  {copy.journeySteps.map((step, index) => (
                    <Reveal key={step.title} delay={index * 0.08}>
                      <article className="relative grid gap-4 sm:grid-cols-[2.5rem_1fr]">
                        <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-sm font-semibold text-[var(--color-accent-strong)] shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                          {index + 1}
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                          <h3 className="text-lg font-semibold text-[var(--color-text)]">{step.title}</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
                            {step.body}
                          </p>
                        </div>
                      </article>
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
                {copy.featuresTitle}
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--color-text)]">
                {copy.practicalToolsTitle}
              </h2>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {copy.practicalFeatures.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.04}>
                <article className="flex h-full gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)]" />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text)]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{feature.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-t border-[var(--color-border)] bg-[var(--color-band)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <Reveal>
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
                  {copy.pricingEyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--color-text)]">
                  {copy.pricingTitle}
                </h2>
                <p className="mt-3 text-base leading-7 text-[var(--color-muted)]">
                  {copy.pricingSubtitle}
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
              <Reveal delay={0.04}>
                <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{copy.freePlanName}</h3>
                    <span className="rs-chip rounded-full px-3 py-1 text-xs font-semibold">{copy.freePlanName}</span>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-[var(--color-text)]">{copy.freePlanPrice}</span>
                    <span className="ml-2 text-sm text-[var(--color-muted)]">{copy.freePlanPriceSuffix}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{copy.freePlanDescription}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {copy.freePlanFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                        <span className="mt-0.5 shrink-0 text-[var(--color-teal)]">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isPro ? (
                    <Link
                      href="/search"
                      className="rs-primary-button mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold"
                    >
                      {copy.startSearchPro}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={freePlanButtonAction}
                      className="rs-primary-button mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold"
                    >
                      {freePlanButtonLabel}
                    </button>
                  )}
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-premium)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{copy.proPlanName}</h3>
                    <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-strong)]">
                      {proPlanBadge}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-bold text-[var(--color-text)]">{proPlanPrice}</span>
                    {proPlanPriceSuffix ? (
                      <span className="text-sm text-[var(--color-muted)]">{proPlanPriceSuffix}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{copy.proPlanDescription}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {copy.proPlanFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                        <span className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {isPro ? (
                    <Link
                      href="/search"
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.24)] transition hover:bg-brass/90 hover:shadow-[0_16px_34px_rgba(215,168,79,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-elevated)]"
                    >
                      {copy.startSearchPro}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startBillingFlow(proPlanButtonMode)}
                      disabled={billingLoading || !billingEnabled}
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.24)] transition hover:bg-brass/90 hover:shadow-[0_16px_34px_rgba(215,168,79,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {billingEnabled ? (billingLoading ? copy.billingLoading : proPlanButtonLabel) : proPlanButtonLabel}
                    </button>
                  )}
                  {billingError ? (
                    <p className="mt-3 text-xs leading-5 text-danger">{billingError}</p>
                  ) : null}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-premium)] sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold text-[var(--color-text)]">
                    {copy.finalCtaTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                    {copy.finalCtaBody}
                  </p>
                </div>
                {finalCtaHref ? (
                  <Link
                    href={finalCtaHref}
                    className="rs-primary-button inline-flex h-12 shrink-0 items-center justify-center rounded-lg px-5 text-sm font-semibold"
                  >
                    {finalCtaLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={finalCtaAction}
                    className="rs-primary-button inline-flex h-12 shrink-0 items-center justify-center rounded-lg px-5 text-sm font-semibold"
                  >
                    {finalCtaLabel}
                  </button>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      </main>

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

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import { FloatingSearchPreview } from "./FloatingSearchPreview";
import { ScrollFeatureCard } from "./ScrollFeatureCard";

// ─── props ────────────────────────────────────────────────────────────────────

export interface CinematicLandingProps {
  language: Language;
  isPro: boolean;
  isAuthenticated: boolean;
  hasPreviousSearch: boolean;
  billingEnabled: boolean;
  billingLoading: boolean;
  billingError: string;
  proPlanPrice: string;
  proPlanPriceSuffix: string;
  proPlanBadge: string;
  proPlanButtonLabel: string;
  proPlanButtonMode: "checkout" | "portal";
  freePlanButtonLabel: string;
  heroPrimaryLabel: string;
  finalCtaLabel: string;
  finalCtaHref?: string;
  onHeroPrimary: () => void;
  onFreePlan: () => void;
  onStartBilling: (mode: "checkout" | "portal") => void;
  onFinalCta: () => void;
}

// ─── cloud layer (reusable inside scenes) ─────────────────────────────────────

function CloudBlobs({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div
        className="sky-cloud-a absolute"
        style={{
          top: "-8%",
          left: "-12%",
          width: "68%",
          height: "72%",
          background: "radial-gradient(ellipse 55% 48% at 45% 50%, var(--cloud-a), transparent)",
          filter: "blur(72px)",
          willChange: "transform",
        }}
      />
      <div
        className="sky-cloud-b absolute"
        style={{
          top: "10%",
          right: "-8%",
          width: "56%",
          height: "58%",
          background: "radial-gradient(ellipse 62% 52% at 56% 44%, var(--cloud-b), transparent)",
          filter: "blur(52px)",
          willChange: "transform",
        }}
      />
      <div
        className="sky-cloud-c absolute"
        style={{
          bottom: "-4%",
          left: "18%",
          width: "64%",
          height: "44%",
          background: "radial-gradient(ellipse 66% 56% at 50% 62%, var(--cloud-c), transparent)",
          filter: "blur(44px)",
          willChange: "transform",
        }}
      />
      <div
        className="sky-cloud-a absolute"
        style={{
          top: "32%",
          left: "28%",
          width: "46%",
          height: "48%",
          background: "radial-gradient(ellipse 52% 44% at 50% 50%, var(--cloud-b), transparent)",
          filter: "blur(58px)",
          opacity: 0.65,
          animationDelay: "-11s",
          willChange: "transform",
        }}
      />
    </div>
  );
}

// ─── scene 1: hero ────────────────────────────────────────────────────────────

function Scene1Hero({
  language,
  shouldReduceMotion,
  heroPrimaryLabel,
  hasPreviousSearch,
  isAuthenticated,
  onHeroPrimary,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
  heroPrimaryLabel: string;
  hasPreviousSearch: boolean;
  isAuthenticated: boolean;
  onHeroPrimary: () => void;
}) {
  const copy = i18n[language];
  const landing = copy.landing;
  const home = copy.home;

  return (
    <section className="cinematic-sky-bg relative min-h-screen overflow-hidden">
      <CloudBlobs />

      {/* Subtle accent glow at top */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "80vw",
          height: "40vh",
          background: "radial-gradient(ellipse at 50% 0%, var(--color-hero-glow), transparent 70%)",
          filter: "blur(12px)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        {/* Eyebrow */}
        <motion.p
          className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)] shadow-[var(--shadow-soft)]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {home.eyebrow}
        </motion.p>

        {/* Main headline */}
        <motion.h1
          className="mt-6 max-w-3xl text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-[var(--color-text)] sm:text-5xl lg:text-6xl xl:text-7xl"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {landing.heroTitle}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {landing.heroSubtitle}
        </motion.p>

        {/* CTA row */}
        <motion.div
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            onClick={onHeroPrimary}
            className="rs-primary-button inline-flex h-12 items-center rounded-xl px-6 text-sm font-semibold"
          >
            {heroPrimaryLabel}
          </button>

          {!isAuthenticated && !hasPreviousSearch ? (
            <Link
              href="/search"
              className="inline-flex h-12 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-6 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-soft)] transition hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-hover)]"
            >
              {home.startSearchNoAccount}
            </Link>
          ) : hasPreviousSearch ? (
            <Link
              href="/search"
              className="inline-flex h-12 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-6 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-soft)] transition hover:border-[var(--color-border-strong)]"
            >
              {home.continueSearch}
            </Link>
          ) : (
            <a
              href="#pricing"
              className="inline-flex h-12 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-6 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-soft)] transition hover:border-[var(--color-border-strong)]"
            >
              {home.viewPlans}
            </a>
          )}
        </motion.div>

        {/* Product highlights */}
        <motion.div
          className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {home.productHighlights.map((h) => (
            <span key={h} className="text-sm text-[var(--color-muted)]">
              <span className="mr-1.5 text-[var(--color-teal)]">✓</span>
              {h}
            </span>
          ))}
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={shouldReduceMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="text-[var(--color-subtle)]"
          >
            <path
              d="M10 4v12M10 16l-5-5M10 16l5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}

// ─── step indicator (used in scene 2 sidebar) ─────────────────────────────────

function StepIndicator({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 w-2 rounded-full transition-all duration-500"
        style={{
          background: active ? "var(--color-teal)" : "var(--color-border-strong)",
          transform: active ? "scale(1.4)" : "scale(1)",
        }}
      />
      <span
        className="text-xs font-medium transition-colors duration-300"
        style={{ color: active ? "var(--color-text)" : "var(--color-subtle)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── results preview (phase 3 of scroll journey) ──────────────────────────────

function ResultsPreview({ language }: { language: Language }) {
  const isNl = language === "nl";
  const items = isNl
    ? [
        { title: "Appartement bij het station", meta: "Amsterdam · 68 m² · 2 kamers", price: "€1.275", label: "Sterke match" },
        { title: "Studio in het centrum", meta: "Amsterdam · 34 m² · eigen keuken", price: "€985", label: "Nieuw" },
        { title: "Rustig 2-kamerappartement", meta: "Amsterdam · 55 m² · beschikbaar", price: "€1.190", label: "Bewaard" },
      ]
    : [
        { title: "Apartment near the station", meta: "Amsterdam · 68 m² · 2 rooms", price: "€1,275", label: "Strong match" },
        { title: "Studio in the city centre", meta: "Amsterdam · 34 m² · private kitchen", price: "€985", label: "New" },
        { title: "Quiet 2-room apartment", meta: "Amsterdam · 55 m² · available", price: "€1,190", label: "Saved" },
      ];

  return (
    <div className="w-full max-w-sm space-y-2.5">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-3 shadow-[var(--shadow-soft)]"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--color-text)]">{item.title}</div>
            <div className="text-xs text-[var(--color-muted)]">{item.meta}</div>
          </div>
          <div className="ml-4 shrink-0 text-right">
            <div className="text-sm font-bold text-[var(--color-text)]">{item.price}</div>
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── scene 2: sticky scroll journey ───────────────────────────────────────────

function Scene2Journey({
  language,
  shouldReduceMotion,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
}) {
  // All hooks must run unconditionally before any early return
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [activeStep, setActiveStep] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (shouldReduceMotion) return;
    if (v < 0.34) setActiveStep(0);
    else if (v < 0.67) setActiveStep(1);
    else setActiveStep(2);
  });

  const landing = i18n[language].landing;

  // Phase 1: visible from the first moment sticky activates, fades out at 30–40%
  const p1Opacity = useTransform(scrollYProgress, [0, 0.3, 0.4], [1, 1, 0]);

  const p2Opacity = useTransform(scrollYProgress, [0.28, 0.44, 0.64, 0.76], [0, 1, 1, 0]);
  const p2Scale = useTransform(scrollYProgress, [0.28, 0.44], [0.9, 1]);
  const p2Y = useTransform(scrollYProgress, [0.28, 0.44], [40, 0]);

  const p3Opacity = useTransform(scrollYProgress, [0.64, 0.8, 0.96, 1.0], [0, 1, 1, 0]);
  const p3Y = useTransform(scrollYProgress, [0.64, 0.8], [50, 0]);

  const stepLabels = [landing.step1Label, landing.step2Label, landing.step3Label] as string[];

  // Reduced motion: skip the 360vh scroll theatre entirely
  if (shouldReduceMotion) {
    return (
      <section className="cinematic-sky-bg relative border-t border-[var(--color-border)] py-24">
        <CloudBlobs />
        <div className="relative mx-auto max-w-lg px-4">
          <p className="mb-6 text-center text-sm font-semibold text-[var(--color-accent-strong)]">
            {landing.step2Label}
          </p>
          <FloatingSearchPreview language={language} />
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} style={{ height: "360vh" }} className="relative">
      <div className="cinematic-sky-bg sticky top-0 h-screen overflow-hidden">
        <CloudBlobs />

        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 50%, var(--color-hero-glow), transparent)",
            opacity: 0.5,
          }}
        />

        {/* Sidebar step indicator (large screens only) */}
        <div className="absolute left-6 top-1/2 hidden -translate-y-1/2 flex-col gap-5 lg:flex">
          {stepLabels.map((label, i) => (
            <StepIndicator key={label} label={label} active={activeStep === i} />
          ))}
        </div>

        {/* Main content */}
        <div className="relative flex h-full items-center justify-center px-4">
          {/* Phase 1: City name */}
          <motion.div
            style={{ opacity: p1Opacity }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
          >
            <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
              {landing.step1Label}
            </p>
            <h2 className="mt-3 text-6xl font-bold tracking-[-0.03em] text-[var(--color-text)] sm:text-7xl lg:text-8xl">
              {landing.phase1Heading}
            </h2>
            <p className="mt-4 text-base text-[var(--color-muted)]">{landing.phase1Sub}</p>
          </motion.div>

          {/* Phase 2: Search form materialises */}
          <motion.div
            style={{ opacity: p2Opacity, scale: p2Scale, y: p2Y }}
            className="absolute inset-0 flex flex-col items-center justify-center px-4"
          >
            <p className="mb-5 text-sm font-semibold text-[var(--color-accent-strong)]">
              {landing.step2Label}
            </p>
            <FloatingSearchPreview language={language} />
          </motion.div>

          {/* Phase 3: Results float up */}
          <motion.div
            style={{ opacity: p3Opacity, y: p3Y }}
            className="absolute inset-0 flex flex-col items-center justify-center px-4"
          >
            <p className="mb-3 text-sm font-semibold text-[var(--color-accent-strong)]">
              {landing.step3Label}
            </p>
            <p className="mb-5 text-2xl font-bold text-[var(--color-text)]">
              {landing.phase3Heading}
            </p>
            <ResultsPreview language={language} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── scene 3: feature cards ───────────────────────────────────────────────────

function Scene3Features({ language }: { language: Language }) {
  const copy = i18n[language].home;
  const directions = ["left", "up", "right", "left", "up", "right"] as const;

  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-band)]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
            {copy.featuresTitle}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--color-text)]">
            {copy.practicalToolsTitle}
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.practicalFeatures.map((feature, index) => (
            <ScrollFeatureCard
              key={feature.title}
              title={feature.title}
              body={feature.body}
              direction={directions[index % directions.length]}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── scene 4: journey steps ───────────────────────────────────────────────────

function Scene4Journey({ language }: { language: Language }) {
  const copy = i18n[language].home;

  return (
    <section className="border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          className="grid gap-8 lg:grid-cols-[0.45fr_1fr] lg:items-start"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
              {copy.stepsTitle}
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[var(--color-text)]">
              {copy.journeyTitle}
            </h2>
          </div>

          <div className="relative grid gap-6">
            <div className="absolute left-[1.18rem] top-8 hidden h-[calc(100%-4rem)] w-px bg-[var(--color-border)] sm:block" />
            {copy.journeySteps.map((step, index) => (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="relative grid gap-4 sm:grid-cols-[2.5rem_1fr]"
              >
                <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-sm font-semibold text-[var(--color-accent-strong)] shadow-[var(--shadow-soft)]">
                  {index + 1}
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">{step.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
                    {step.body}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── scene 5: pricing ─────────────────────────────────────────────────────────

function Scene5Pricing({
  language,
  isPro,
  billingEnabled,
  billingLoading,
  billingError,
  proPlanPrice,
  proPlanPriceSuffix,
  proPlanBadge,
  proPlanButtonLabel,
  proPlanButtonMode,
  freePlanButtonLabel,
  onFreePlan,
  onStartBilling,
}: {
  language: Language;
  isPro: boolean;
  billingEnabled: boolean;
  billingLoading: boolean;
  billingError: string;
  proPlanPrice: string;
  proPlanPriceSuffix: string;
  proPlanBadge: string;
  proPlanButtonLabel: string;
  proPlanButtonMode: "checkout" | "portal";
  freePlanButtonLabel: string;
  onFreePlan: () => void;
  onStartBilling: (mode: "checkout" | "portal") => void;
}) {
  const copy = i18n[language].home;

  return (
    <section id="pricing" className="border-t border-[var(--color-border)] bg-[var(--color-band)]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
            {copy.pricingEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-[var(--color-text)]">{copy.pricingTitle}</h2>
          <p className="mt-3 text-base leading-7 text-[var(--color-muted)]">{copy.pricingSubtitle}</p>
        </motion.div>

        <div className="mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          {/* Free plan */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
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
                className="rs-primary-button mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                {copy.startSearchPro}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onFreePlan}
                className="rs-primary-button mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                {freePlanButtonLabel}
              </button>
            )}
          </motion.div>

          {/* Pro plan */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="flex h-full flex-col rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-premium)]"
          >
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
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.24)] transition hover:bg-brass/90"
              >
                {copy.startSearchPro}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onStartBilling(proPlanButtonMode)}
                disabled={billingLoading || !billingEnabled}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-brass/40 bg-brass px-5 text-sm font-semibold text-ink shadow-[0_12px_28px_rgba(215,168,79,0.24)] transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {billingEnabled
                  ? billingLoading
                    ? copy.billingLoading
                    : proPlanButtonLabel
                  : proPlanButtonLabel}
              </button>
            )}
            {billingError ? (
              <p className="mt-3 text-xs leading-5 text-danger">{billingError}</p>
            ) : null}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── scene 6: cloud-parting final CTA ─────────────────────────────────────────

function Scene6CloudCTA({
  language,
  finalCtaLabel,
  finalCtaHref,
  onFinalCta,
}: {
  language: Language;
  finalCtaLabel: string;
  finalCtaHref?: string;
  onFinalCta: () => void;
}) {
  const landing = i18n[language].landing;

  return (
    <section className="cinematic-sky-bg relative overflow-hidden py-24">
      {/* Parting cloud left */}
      <motion.div
        aria-hidden
        initial={{ x: 0 }}
        whileInView={{ x: "-40%" }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 95% 50%, var(--cloud-b), transparent 72%)",
          filter: "blur(52px)",
        }}
      />
      {/* Parting cloud right */}
      <motion.div
        aria-hidden
        initial={{ x: 0 }}
        whileInView={{ x: "40%" }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute bottom-0 right-0 top-0 w-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 5% 50%, var(--cloud-b), transparent 72%)",
          filter: "blur(52px)",
        }}
      />

      {/* Content revealed by parting clouds */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.45 }}
        transition={{ duration: 0.65, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-2xl px-4 text-center"
      >
        <h2 className="text-3xl font-bold tracking-[-0.01em] text-[var(--color-text)] sm:text-4xl">
          {landing.cloudCtaTitle}
        </h2>
        <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">{landing.cloudCtaBody}</p>

        <div className="mt-8">
          {finalCtaHref ? (
            <Link
              href={finalCtaHref}
              className="rs-primary-button inline-flex h-12 items-center rounded-xl px-8 text-sm font-semibold"
            >
              {finalCtaLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onFinalCta}
              className="rs-primary-button inline-flex h-12 items-center rounded-xl px-8 text-sm font-semibold"
            >
              {finalCtaLabel}
            </button>
          )}
        </div>
      </motion.div>
    </section>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────

export function CinematicLanding({
  language,
  isPro,
  isAuthenticated,
  hasPreviousSearch,
  billingEnabled,
  billingLoading,
  billingError,
  proPlanPrice,
  proPlanPriceSuffix,
  proPlanBadge,
  proPlanButtonLabel,
  proPlanButtonMode,
  freePlanButtonLabel,
  heroPrimaryLabel,
  finalCtaLabel,
  finalCtaHref,
  onHeroPrimary,
  onFreePlan,
  onStartBilling,
  onFinalCta,
}: CinematicLandingProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <main>
      <Scene1Hero
        language={language}
        shouldReduceMotion={shouldReduceMotion}
        heroPrimaryLabel={heroPrimaryLabel}
        hasPreviousSearch={hasPreviousSearch}
        isAuthenticated={isAuthenticated}
        onHeroPrimary={onHeroPrimary}
      />

      <Scene2Journey language={language} shouldReduceMotion={shouldReduceMotion} />

      <Scene3Features language={language} />

      <Scene4Journey language={language} />

      <Scene5Pricing
        language={language}
        isPro={isPro}
        billingEnabled={billingEnabled}
        billingLoading={billingLoading}
        billingError={billingError}
        proPlanPrice={proPlanPrice}
        proPlanPriceSuffix={proPlanPriceSuffix}
        proPlanBadge={proPlanBadge}
        proPlanButtonLabel={proPlanButtonLabel}
        proPlanButtonMode={proPlanButtonMode}
        freePlanButtonLabel={freePlanButtonLabel}
        onFreePlan={onFreePlan}
        onStartBilling={onStartBilling}
      />

      <Scene6CloudCTA
        language={language}
        finalCtaLabel={finalCtaLabel}
        finalCtaHref={finalCtaHref}
        onFinalCta={onFinalCta}
      />
    </main>
  );
}

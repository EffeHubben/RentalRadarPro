"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import { FloatingSearchPreview } from "./FloatingSearchPreview";

export interface CinematicLandingProps {
  language: Language;
  onHeroPrimary: () => void;
}

// ─── Sky atmosphere ───────────────────────────────────────────────────────────
// Soft radial cloud shapes — no harsh linear gradient, no near-opaque bands.
function SkyAtmosphere({ variant = "hero" }: { variant?: "hero" | "section" | "cta" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Warm top glow */}
      <div
        className="absolute inset-x-0 top-0 h-[55%]"
        style={{
          background:
            "radial-gradient(ellipse 88% 58% at 50% -8%, var(--color-hero-glow), transparent 72%)",
        }}
      />

      {/* Upper-left cloud mass */}
      <div
        className="sky-cloud-a absolute"
        style={{
          left: "-12%",
          top: "4%",
          width: "58%",
          height: "52%",
          background: [
            "radial-gradient(ellipse 64% 56% at 26% 42%, var(--cloud-a), transparent 68%)",
            "radial-gradient(ellipse 46% 42% at 74% 56%, var(--cloud-b), transparent 62%)",
          ].join(", "),
          filter: "blur(40px)",
        }}
      />

      {/* Upper-right cloud mass */}
      <div
        className="sky-cloud-b absolute"
        style={{
          right: "-8%",
          top: "0%",
          width: "52%",
          height: "48%",
          background:
            "radial-gradient(ellipse 58% 50% at 62% 36%, var(--cloud-a), transparent 68%)",
          filter: "blur(44px)",
        }}
      />

      {/* Bottom teal haze */}
      <div
        className="sky-cloud-c absolute inset-x-0 bottom-0 h-[38%]"
        style={{
          background:
            "radial-gradient(ellipse 100% 82% at 50% 100%, var(--cloud-c), transparent 78%)",
          filter: "blur(30px)",
        }}
      />

      {/* Center mid-level wisp — hero only */}
      {variant === "hero" && (
        <div
          className="sky-cloud-d absolute"
          style={{
            left: "18%",
            top: "48%",
            width: "64%",
            height: "28%",
            background:
              "radial-gradient(ellipse 78% 48% at 50% 50%, var(--cloud-a), transparent 70%)",
            filter: "blur(50px)",
          }}
        />
      )}

      {/* Section: extra top cloud strip */}
      {(variant === "section" || variant === "cta") && (
        <div
          className="sky-cloud-a absolute inset-x-[-20%] top-0 h-[38%]"
          style={{
            background:
              "radial-gradient(ellipse 80% 62% at 50% 0%, var(--cloud-a), transparent 70%)",
            filter: "blur(52px)",
          }}
        />
      )}
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────
function HeroSection({
  language,
  shouldReduceMotion,
  onHeroPrimary,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
  onHeroPrimary: () => void;
}) {
  const landing = i18n[language].landing;

  return (
    <section
      className="relative isolate overflow-hidden lg:min-h-[calc(100vh-80px)]"
      style={{ background: "var(--color-page)" }}
    >
      <SkyAtmosphere variant="hero" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:min-h-[calc(100vh-80px)] lg:px-8 lg:py-0 xl:gap-16">
        {/* Left: headline + CTAs */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
        >
          <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
            RentScout
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-[var(--color-text)] sm:text-6xl lg:text-7xl">
            {landing.heroTitle}
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-7 text-[var(--color-muted)]">
            {landing.heroSubtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center lg:justify-start">
            <button
              type="button"
              onClick={onHeroPrimary}
              className="rs-primary-button inline-flex h-12 items-center justify-center rounded-xl px-7 text-sm font-semibold"
            >
              {landing.heroPrimary}
            </button>
            <Link
              href="/search"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-7 text-sm font-semibold text-[var(--color-text)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-hover)]"
            >
              {landing.heroSecondary}
            </Link>
          </div>
        </motion.div>

        {/* Right: product mockup */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.82, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[660px]"
        >
          <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <FloatingSearchPreview language={language} size="hero" />
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom section fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-page))" }}
      />
    </section>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({
  title,
  body,
  index,
  shouldReduceMotion,
}: {
  title: string;
  body: string;
  index: number;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.48, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)]"
          style={{
            boxShadow: "0 0 8px var(--color-teal)",
            border: "1.5px solid rgba(255,255,255,0.4)",
          }}
        />
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{body}</p>
        </div>
      </div>
    </motion.article>
  );
}

// ─── Features section ─────────────────────────────────────────────────────────
function FeaturesSection({
  language,
  shouldReduceMotion,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
}) {
  const landing = i18n[language].landing;
  const cards = landing.storyCards;

  return (
    <section
      className="relative isolate overflow-hidden py-20 sm:py-24 lg:py-28"
      style={{ background: "var(--color-page)" }}
    >
      <SkyAtmosphere variant="section" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
            {landing.storyEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-[var(--color-text)] sm:text-4xl">
            {landing.storyTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--color-muted)]">
            {landing.storyBody}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              title={card.title}
              body={card.body}
              index={i}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA section ────────────────────────────────────────────────────────
function FinalCtaSection({
  language,
  shouldReduceMotion,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
}) {
  const landing = i18n[language].landing;

  return (
    <section
      className="relative isolate overflow-hidden py-20 sm:py-24"
      style={{ background: "var(--color-page)" }}
    >
      <SkyAtmosphere variant="cta" />

      <div className="relative z-10 mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-8 shadow-[var(--shadow-premium)] backdrop-blur-2xl sm:p-12"
        >
          {/* Internal top glow accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32"
            style={{
              background:
                "radial-gradient(ellipse 100% 100% at 50% 0%, var(--color-accent-soft), transparent 75%)",
            }}
          />

          <div className="relative">
            <h2 className="text-3xl font-bold tracking-[-0.025em] text-[var(--color-text)] sm:text-4xl">
              {landing.cloudCtaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--color-muted)]">
              {landing.cloudCtaBody}
            </p>
            <Link
              href="/search"
              className="rs-primary-button mt-8 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold"
            >
              {landing.cloudCtaButton}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function CinematicLanding({ language, onHeroPrimary }: CinematicLandingProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <main>
      <HeroSection
        language={language}
        shouldReduceMotion={shouldReduceMotion}
        onHeroPrimary={onHeroPrimary}
      />
      <FeaturesSection language={language} shouldReduceMotion={shouldReduceMotion} />
      <FinalCtaSection language={language} shouldReduceMotion={shouldReduceMotion} />
    </main>
  );
}

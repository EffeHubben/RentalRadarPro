"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, type MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import { FloatingSearchPreview } from "./FloatingSearchPreview";

export interface CinematicLandingProps {
  language: Language;
  onHeroPrimary: () => void;
}

// ─── Cloud layer ─────────────────────────────────────────────────────────────
// Four depth levels. Key difference from old CloudField: blur is much lower on
// near/front layers so cloud shapes are actually readable. Each layer uses
// full-width horizontal bands rather than small point-blobs.
type CloudDepth = "far" | "mid" | "near" | "front";

function CloudLayer({
  depth = "mid",
  className = "",
}: {
  depth?: CloudDepth;
  className?: string;
}) {
  const blur = { far: 42, mid: 18, near: 8, front: 4 }[depth];
  const opacity = { far: 0.62, mid: 0.90, near: 0.78, front: 0.68 }[depth];

  // Top cloud band positions per depth
  const band1Top = { far: "0%", mid: "8%", near: "28%", front: "36%" }[depth];
  const band2Top = { far: "24%", mid: "34%", near: "50%", front: "58%" }[depth];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Primary wide cloud band */}
      <div
        className="sky-cloud-a absolute"
        style={{
          left: "-22%",
          right: "-22%",
          top: band1Top,
          height: "30%",
          background: [
            "radial-gradient(ellipse 50% 65% at 18% 54%, var(--cloud-a), transparent 62%)",
            "radial-gradient(ellipse 44% 58% at 54% 44%, var(--cloud-a), transparent 58%)",
            "radial-gradient(ellipse 38% 55% at 84% 58%, var(--cloud-b), transparent 55%)",
          ].join(", "),
          filter: `blur(${blur}px)`,
        }}
      />

      {/* Secondary cloud band */}
      <div
        className="sky-cloud-b absolute"
        style={{
          left: "-18%",
          right: "-18%",
          top: band2Top,
          height: "24%",
          background: [
            "radial-gradient(ellipse 46% 62% at 32% 52%, var(--cloud-b), transparent 60%)",
            "radial-gradient(ellipse 40% 56% at 74% 48%, var(--cloud-a), transparent 55%)",
          ].join(", "),
          filter: `blur(${blur * 0.85}px)`,
          animationDelay: "-9s",
        }}
      />

      {/* Cloud floor / bottom atmosphere */}
      <div
        className="sky-cloud-c absolute"
        style={{
          bottom: "-12%",
          left: "-18%",
          right: "-18%",
          height: "32%",
          background: [
            "radial-gradient(ellipse 80% 70% at 50% 78%, var(--cloud-c), transparent 72%)",
            "radial-gradient(ellipse 50% 56% at 16% 64%, var(--cloud-a), transparent 58%)",
            "radial-gradient(ellipse 45% 54% at 84% 68%, var(--cloud-b), transparent 55%)",
          ].join(", "),
          filter: `blur(${blur * 1.15}px)`,
          animationDelay: "-16s",
        }}
      />

      {/* Extra puff for closer layers — adds mid-scene cloudiness */}
      {(depth === "near" || depth === "front") && (
        <div
          className="sky-cloud-d absolute"
          style={{
            left: depth === "front" ? "2%" : "10%",
            top: depth === "front" ? "16%" : "42%",
            width: "65%",
            height: "22%",
            background:
              "radial-gradient(ellipse 78% 62% at 44% 52%, var(--cloud-a), transparent 66%)",
            filter: `blur(${blur * 0.65}px)`,
            animationDelay: "-21s",
          }}
        />
      )}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
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
    <section className="cinematic-sky-bg relative isolate min-h-[100svh] overflow-hidden">
      {/* Warm top glow */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[50vh]"
        style={{
          background:
            "radial-gradient(ellipse 92% 58% at 50% 0%, var(--color-hero-glow), transparent 68%)",
          filter: "blur(8px)",
        }}
      />

      {/* Background cloud layers */}
      <CloudLayer depth="far" className="z-0" />
      <CloudLayer depth="mid" className="z-[5]" />

      {/* Teal atmosphere at the bottom */}
      <div
        aria-hidden
        className="absolute inset-x-[-10%] bottom-[-12%] z-[6] h-[40vh]"
        style={{
          background:
            "radial-gradient(ellipse 105% 80% at 50% 92%, var(--cloud-c), transparent 74%)",
          filter: "blur(28px)",
          opacity: 0.88,
        }}
      />

      {/* Main hero content */}
      <div className="relative z-30 mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
        >
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-4 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
            RentScout
          </p>
          <h1 className="mt-6 text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-[var(--color-text)] sm:text-6xl lg:text-7xl xl:text-8xl">
            {landing.heroTitle}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--color-muted)] sm:text-lg lg:text-xl">
            {landing.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
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

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 34, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.82, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[680px]"
        >
          {/* Teal glow behind mockup */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[88%] w-[94%] -translate-x-1/2 -translate-y-1/2 rounded-[48px]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 52%, var(--color-teal-soft), transparent 70%)",
              filter: "blur(22px)",
            }}
          />
          {/* Warm cloud shadow below mockup */}
          <div
            aria-hidden
            className="absolute inset-x-10 bottom-[-8%] h-16 rounded-full"
            style={{
              background: "var(--cloud-b)",
              filter: "blur(30px)",
              opacity: 0.55,
            }}
          />
          <FloatingSearchPreview language={language} size="hero" />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div aria-hidden className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2">
        <motion.div
          animate={shouldReduceMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="h-10 w-6 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl"
        >
          <div className="mx-auto h-2 w-1 rounded-full bg-[var(--color-accent-strong)]" />
        </motion.div>
      </div>

      {/* Foreground cloud curtain — passes in front of content */}
      <CloudLayer depth="near" className="z-20" />
      <CloudLayer depth="front" className="z-[22]" />
    </section>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
// Cards 0 and 1 start partially visible; the rest animate in as scroll advances.
function FeatureCard({
  title,
  body,
  progress,
  index,
  className,
}: {
  title: string;
  body: string;
  progress: MotionValue<number>;
  index: number;
  className: string;
}) {
  const starts = [0.02, 0.08, 0.22, 0.34, 0.46];
  const start = starts[index] ?? 0.2;
  const end = start + 0.10;
  const startOpacity = index < 2 ? 0.80 : 0;

  const opacity = useTransform(
    progress,
    [0, start, end, 0.88, 1],
    [startOpacity, startOpacity, 1, 1, 0.72],
  );
  const xDir = index % 2 === 0 ? -1 : 1;
  const x = useTransform(
    progress,
    [start, end],
    [xDir * (index < 2 ? 18 : 38), 0],
  );
  const y = useTransform(progress, [start, end], [index < 2 ? 10 : 22, 0]);

  return (
    <motion.article
      style={{ opacity, x, y }}
      className={`absolute w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-premium)] backdrop-blur-2xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)] shadow-[0_0_20px_var(--color-teal)]"
          style={{ border: "1.5px solid rgba(255,255,255,0.45)" }}
        />
        <div>
          <h3 className="text-sm font-semibold leading-5 text-[var(--color-text)]">{title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{body}</p>
        </div>
      </div>
    </motion.article>
  );
}

// Cards positioned closer to center so they overlap the mockup edges
const CARD_POSITIONS = [
  "left-[calc(50%_-_25rem)] top-[20%]",
  "right-[calc(50%_-_25rem)] top-[22%]",
  "left-[calc(50%_-_23rem)] bottom-[22%]",
  "right-[calc(50%_-_23rem)] bottom-[20%]",
  "left-1/2 top-[8%] -translate-x-1/2",
];

// ─── Desktop sticky story ─────────────────────────────────────────────────────
function DesktopStickyStorySection({ language }: { language: Language }) {
  const landing = i18n[language].landing;
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Each cloud layer moves at a different speed to create depth parallax
  const farY = useTransform(scrollYProgress, [0, 1], ["0%", "9%"]);
  const midY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  const nearY = useTransform(scrollYProgress, [0, 1], ["0%", "-26%"]);
  const frontY = useTransform(scrollYProgress, [0, 1], ["0%", "-38%"]);
  const frontX = useTransform(scrollYProgress, [0, 1], ["0%", "5%"]);

  // Product mockup rises and scales up as user scrolls into the scene
  const previewScale = useTransform(scrollYProgress, [0, 0.22, 0.70, 1], [0.92, 1.04, 1.04, 0.96]);
  const previewY = useTransform(scrollYProgress, [0, 0.28, 0.75, 1], [24, 0, -6, -20]);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.05, 0.90, 1], [0.88, 1, 1, 0.75]);

  // Intro text fades out by 40% scroll
  const introOpacity = useTransform(scrollYProgress, [0, 0.20, 0.42], [1, 0.90, 0]);

  // CTA emerges in the last ~30%
  const ctaOpacity = useTransform(scrollYProgress, [0.58, 0.72, 1], [0, 1, 1]);
  const ctaY = useTransform(scrollYProgress, [0.58, 0.78], [28, 0]);
  const ctaScale = useTransform(scrollYProgress, [0.58, 0.82], [0.96, 1]);

  const cards = landing.storyCards;

  return (
    <section
      ref={containerRef}
      className="cinematic-sky-bg relative isolate hidden h-[250vh] lg:block"
    >
      {/* Non-sticky background cloud tint so the section isn't blank before sticking */}
      <CloudLayer depth="far" className="opacity-45" />

      <div className="cinematic-sky-bg sticky top-0 isolate min-h-[100svh] overflow-hidden">
        {/* Ambient sky overlays */}
        <div
          aria-hidden
          className="absolute inset-0 z-0"
          style={{
            background: [
              "radial-gradient(ellipse 100% 52% at 50% 0%, var(--color-hero-glow), transparent 56%)",
              "radial-gradient(ellipse 85% 42% at 50% 100%, var(--color-teal-soft), transparent 52%)",
            ].join(", "),
          }}
        />

        {/* Far and mid clouds move slowly upward */}
        <motion.div style={{ y: farY }} className="absolute inset-0 z-[2]">
          <CloudLayer depth="far" />
        </motion.div>
        <motion.div style={{ y: midY }} className="absolute inset-0 z-[4]">
          <CloudLayer depth="mid" />
        </motion.div>

        {/* Section intro */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="absolute left-1/2 top-[8%] z-20 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 text-center"
        >
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
            {landing.storyEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[var(--color-text)] sm:text-4xl">
            {landing.storyTitle}
          </h2>
        </motion.div>

        {/* Product mockup — central visual anchor */}
        <div className="absolute inset-0 z-30 flex items-center justify-center px-4">
          <motion.div
            style={{ scale: previewScale, y: previewY, opacity: previewOpacity }}
            className="relative w-full max-w-[640px]"
          >
            {/* Cloud glow ring around mockup */}
            <div
              aria-hidden
              className="absolute inset-[-10%] rounded-[52px]"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 52%, var(--color-teal-soft), transparent 65%)",
                filter: "blur(32px)",
              }}
            />
            <FloatingSearchPreview language={language} size="story" />
          </motion.div>
        </div>

        {/* Feature cards — overlapping mockup edges */}
        <div className="absolute inset-0 z-40">
          {cards.map((card, index) => (
            <FeatureCard
              key={card.title}
              title={card.title}
              body={card.body}
              progress={scrollYProgress}
              index={index}
              className={CARD_POSITIONS[index] ?? ""}
            />
          ))}
        </div>

        {/* Near + front clouds pass over cards and mockup */}
        <motion.div style={{ y: nearY }} className="absolute inset-0 z-[35]">
          <CloudLayer depth="near" />
        </motion.div>
        <motion.div style={{ y: frontY, x: frontX }} className="absolute inset-0 z-[36]">
          <CloudLayer depth="front" />
        </motion.div>

        {/* Final CTA — clouds open, card slides up */}
        <motion.div
          style={{ opacity: ctaOpacity, y: ctaY, scale: ctaScale }}
          className="absolute bottom-8 left-1/2 z-[60] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-8 text-center shadow-[var(--shadow-premium)] backdrop-blur-2xl"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 100% 60% at 50% 0%, var(--color-accent-soft), transparent 65%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-[-0.025em] text-[var(--color-text)]">
              {landing.cloudCtaTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--color-muted)]">
              {landing.cloudCtaBody}
            </p>
            <Link
              href="/search"
              className="rs-primary-button mt-6 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold"
            >
              {landing.cloudCtaButton}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Mobile story section ─────────────────────────────────────────────────────
function MobileStorySection({
  language,
  shouldReduceMotion,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
}) {
  const landing = i18n[language].landing;
  const cards = landing.storyCards;

  return (
    <section className="cinematic-sky-bg relative isolate overflow-hidden lg:hidden">
      <CloudLayer depth="far" />
      <CloudLayer depth="mid" />

      <div className="relative z-20 mx-auto grid max-w-xl gap-7 px-4 py-14 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
            {landing.storyEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-[var(--color-text)]">
            {landing.storyTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-[var(--color-muted)]">
            {landing.storyBody}
          </p>
        </div>

        <FloatingSearchPreview language={language} size="story" />

        <div className="grid gap-3">
          {cards.map((card, i) => (
            <motion.article
              key={card.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.42, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)] shadow-[0_0_18px_var(--color-teal)]"
                  style={{ border: "1.5px solid rgba(255,255,255,0.4)" }}
                />
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-5 text-[var(--color-muted)]">{card.body}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 text-center shadow-[var(--shadow-premium)] backdrop-blur-2xl">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-24"
            style={{
              background:
                "radial-gradient(ellipse 100% 80% at 50% 0%, var(--color-accent-soft), transparent 72%)",
            }}
          />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-[var(--color-text)]">
              {landing.cloudCtaTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{landing.cloudCtaBody}</p>
            <Link
              href="/search"
              className="rs-primary-button mt-5 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold"
            >
              {landing.cloudCtaButton}
            </Link>
          </div>
        </div>
      </div>

      <CloudLayer depth="near" className="z-10" />
    </section>
  );
}

// ─── Reduced-motion layout ────────────────────────────────────────────────────
// Static but still cinematic — clouds visible, product present, all content accessible.
function ReducedMotionStory({ language }: { language: Language }) {
  const landing = i18n[language].landing;
  const cards = landing.storyCards;

  return (
    <section className="cinematic-sky-bg relative overflow-hidden border-y border-[var(--color-border)] px-4 py-14 sm:px-6 lg:px-8">
      <CloudLayer depth="far" />
      <CloudLayer depth="mid" />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">{landing.storyEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-[var(--color-text)] sm:text-5xl">
            {landing.storyTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">{landing.storyBody}</p>
        </div>
        <FloatingSearchPreview language={language} size="story" />
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{card.body}</p>
            </article>
          ))}
        </div>
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 text-center shadow-[var(--shadow-premium)] backdrop-blur-2xl lg:col-span-2">
          <h2 className="text-3xl font-bold tracking-[-0.025em] text-[var(--color-text)]">
            {landing.cloudCtaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-muted)]">
            {landing.cloudCtaBody}
          </p>
          <Link
            href="/search"
            className="rs-primary-button mt-6 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold"
          >
            {landing.cloudCtaButton}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function CinematicLanding({ language, onHeroPrimary }: CinematicLandingProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <main>
        <HeroSection
          language={language}
          shouldReduceMotion={shouldReduceMotion}
          onHeroPrimary={onHeroPrimary}
        />
        <ReducedMotionStory language={language} />
      </main>
    );
  }

  return (
    <main>
      <HeroSection
        language={language}
        shouldReduceMotion={shouldReduceMotion}
        onHeroPrimary={onHeroPrimary}
      />
      {/* Mobile story — only shown below lg breakpoint */}
      <MobileStorySection language={language} shouldReduceMotion={shouldReduceMotion} />
      {/* Desktop sticky story — only shown at lg+ */}
      <DesktopStickyStorySection language={language} />
    </main>
  );
}

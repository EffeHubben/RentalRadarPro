"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import { FloatingSearchPreview } from "./FloatingSearchPreview";

export interface CinematicLandingProps {
  language: Language;
  onHeroPrimary: () => void;
}

type CloudDepth = "far" | "mid" | "front";
type FeatureDirection = "left" | "right" | "bottom";

const featureDirections: FeatureDirection[] = ["left", "right", "bottom", "left", "right"];

function CloudField({ depth = "mid", className = "" }: { depth?: CloudDepth; className?: string }) {
  const blur = depth === "front" ? "blur(34px)" : depth === "mid" ? "blur(48px)" : "blur(72px)";
  const opacity = depth === "front" ? 0.46 : depth === "mid" ? 0.78 : 0.58;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <div
        className="sky-cloud-a absolute"
        style={{
          left: depth === "front" ? "-16%" : "-10%",
          top: depth === "front" ? "53%" : "-6%",
          width: depth === "front" ? "74%" : "62%",
          height: depth === "front" ? "36%" : "58%",
          background: "radial-gradient(ellipse 58% 46% at 50% 52%, var(--cloud-a), transparent 72%)",
          filter: blur,
        }}
      />
      <div
        className="sky-cloud-b absolute"
        style={{
          right: depth === "front" ? "-20%" : "-12%",
          top: depth === "front" ? "44%" : "8%",
          width: depth === "front" ? "78%" : "58%",
          height: depth === "front" ? "42%" : "50%",
          background: "radial-gradient(ellipse 62% 50% at 46% 52%, var(--cloud-b), transparent 72%)",
          filter: blur,
          animationDelay: "-9s",
        }}
      />
      <div
        className="sky-cloud-c absolute"
        style={{
          bottom: depth === "front" ? "-10%" : "4%",
          left: depth === "front" ? "18%" : "22%",
          width: depth === "front" ? "76%" : "56%",
          height: depth === "front" ? "36%" : "34%",
          background: "radial-gradient(ellipse 68% 54% at 50% 56%, var(--cloud-c), transparent 74%)",
          filter: blur,
          animationDelay: "-16s",
        }}
      />
    </div>
  );
}

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
      <CloudField depth="far" />
      <CloudField depth="mid" className="opacity-90" />

      <div
        aria-hidden
        className="absolute inset-x-[-10%] top-[-18%] h-[58vh]"
        style={{
          background: "radial-gradient(ellipse at 50% 12%, var(--color-hero-glow), transparent 68%)",
          filter: "blur(10px)",
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
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
          initial={shouldReduceMotion ? false : { opacity: 0, y: 34, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.78, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[680px]"
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[86%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[48px]"
            style={{
              background: "radial-gradient(ellipse at 50% 52%, var(--color-teal-soft), transparent 68%)",
              filter: "blur(20px)",
            }}
          />
          <FloatingSearchPreview language={language} size="hero" />
        </motion.div>
      </div>

      <CloudField depth="front" className="z-20" />
    </section>
  );
}

function FloatingFeatureCard({
  title,
  body,
  progress,
  index,
  direction,
  className,
}: {
  title: string;
  body: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  index: number;
  direction: FeatureDirection;
  className: string;
}) {
  const start = 0.28 + index * 0.07;
  const full = start + 0.08;
  const opacity = useTransform(progress, [start, full, 0.86, 0.98], [0, 1, 1, 0.88]);
  const y = useTransform(progress, [start, full], [direction === "bottom" ? 44 : 20, 0]);
  const x = useTransform(
    progress,
    [start, full],
    [direction === "left" ? -42 : direction === "right" ? 42 : 0, 0],
  );

  return (
    <motion.article
      style={{ opacity, x, y }}
      className={`absolute w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-premium)] backdrop-blur-2xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-teal)] shadow-[0_0_18px_var(--color-teal)]"
        />
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{body}</p>
        </div>
      </div>
    </motion.article>
  );
}

function StickyStorySection({
  language,
  shouldReduceMotion,
}: {
  language: Language;
  shouldReduceMotion: boolean | null;
}) {
  const landing = i18n[language].landing;
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const farY = useTransform(scrollYProgress, [0, 1], ["-4%", "8%"]);
  const midY = useTransform(scrollYProgress, [0, 1], ["6%", "-12%"]);
  const frontY = useTransform(scrollYProgress, [0, 1], ["14%", "-18%"]);
  const frontX = useTransform(scrollYProgress, [0, 1], ["-4%", "6%"]);
  const previewScale = useTransform(scrollYProgress, [0, 0.22, 0.56, 0.9], [0.9, 1.08, 1.14, 0.98]);
  const previewY = useTransform(scrollYProgress, [0, 0.22, 0.7, 1], [34, 0, -12, -32]);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.06, 0.86, 1], [0.82, 1, 1, 0.68]);
  const introOpacity = useTransform(scrollYProgress, [0, 0.18, 0.34], [1, 0.72, 0.18]);
  const ctaOpacity = useTransform(scrollYProgress, [0.64, 0.76, 1], [0, 1, 1]);
  const ctaY = useTransform(scrollYProgress, [0.64, 0.86], [22, 0]);

  const cards = landing.storyCards;
  const positions = [
    "left-[4%] top-[18%] hidden lg:block",
    "right-[4%] top-[19%] hidden lg:block",
    "left-[6%] bottom-[14%] hidden lg:block",
    "right-[6%] bottom-[14%] hidden lg:block",
    "left-1/2 top-[8%] hidden -translate-x-1/2 lg:block",
  ];

  if (shouldReduceMotion) {
    return (
      <section className="cinematic-sky-bg relative overflow-hidden border-y border-[var(--color-border)] px-4 py-16 sm:px-6 lg:px-8">
        <CloudField depth="far" />
        <CloudField depth="mid" />
        <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
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
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)]"
              >
                <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="cinematic-sky-bg relative isolate h-[280vh] overflow-clip">
      <CloudField depth="far" className="opacity-70" />
      <CloudField depth="mid" className="opacity-65" />
      <div className="cinematic-sky-bg sticky top-0 isolate min-h-[100svh] overflow-hidden">
        <motion.div style={{ y: farY }} className="absolute inset-0">
          <CloudField depth="far" />
        </motion.div>
        <motion.div style={{ y: midY }} className="absolute inset-0 z-10">
          <CloudField depth="mid" />
        </motion.div>

        <div
          aria-hidden
          className="absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 48%, var(--color-hero-glow), transparent 54%), linear-gradient(180deg, transparent, rgba(255,255,255,0.08))",
          }}
        />

        <motion.div
          style={{ opacity: introOpacity }}
          className="absolute left-1/2 top-[12%] z-20 w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 text-center"
        >
          <p className="text-sm font-semibold text-[var(--color-accent-strong)]">{landing.storyEyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[var(--color-text)] sm:text-5xl">
            {landing.storyTitle}
          </h2>
        </motion.div>

        <div className="absolute inset-0 z-30 flex items-center justify-center px-4">
          <motion.div style={{ scale: previewScale, y: previewY, opacity: previewOpacity }} className="w-full max-w-[720px]">
            <FloatingSearchPreview language={language} size="story" />
          </motion.div>
        </div>

        <div className="absolute inset-0 z-40">
          {cards.map((card, index) => (
            <FloatingFeatureCard
              key={card.title}
              title={card.title}
              body={card.body}
              progress={scrollYProgress}
              index={index}
              direction={featureDirections[index]}
              className={positions[index]}
            />
          ))}
        </div>

        <motion.div style={{ x: frontX, y: frontY }} className="absolute inset-0 z-[35]">
          <CloudField depth="front" />
        </motion.div>

        <motion.div
          style={{ opacity: ctaOpacity, y: ctaY }}
          className="absolute bottom-8 left-1/2 z-[60] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 text-center shadow-[var(--shadow-premium)] backdrop-blur-2xl sm:bottom-10"
        >
          <p className="text-sm font-semibold text-[var(--color-text)]">{landing.storyEndTitle}</p>
          <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)] sm:text-sm">{landing.storyEndBody}</p>
        </motion.div>
      </div>

      <div className="cinematic-sky-bg relative z-10 border-t border-[var(--color-border)] px-4 py-12 sm:px-6 lg:hidden">
        <div className="mx-auto grid max-w-md gap-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-[var(--color-muted)]">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ language }: { language: Language }) {
  const landing = i18n[language].landing;

  return (
    <section className="cinematic-sky-bg relative isolate overflow-hidden px-4 py-24 text-center sm:px-6 lg:px-8">
      <CloudField depth="far" />
      <div
        aria-hidden
        className="absolute inset-x-[12%] top-8 h-40 rounded-full"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, var(--color-hero-glow), transparent 70%)",
          filter: "blur(26px)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <h2 className="text-4xl font-bold tracking-[-0.035em] text-[var(--color-text)] sm:text-5xl">
          {landing.cloudCtaTitle}
        </h2>
        <p className="mt-5 text-base leading-7 text-[var(--color-muted)] sm:text-lg">{landing.cloudCtaBody}</p>
        <div className="mt-8">
          <Link
            href="/search"
            className="rs-primary-button inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold"
          >
            {landing.cloudCtaButton}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CinematicLanding({ language, onHeroPrimary }: CinematicLandingProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <main>
      <HeroSection
        language={language}
        shouldReduceMotion={shouldReduceMotion}
        onHeroPrimary={onHeroPrimary}
      />
      <StickyStorySection language={language} shouldReduceMotion={shouldReduceMotion} />
      <FinalCtaSection language={language} />
    </main>
  );
}

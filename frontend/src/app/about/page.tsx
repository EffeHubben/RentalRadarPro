"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

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
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.42, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function AboutPage() {
  const { language, changeLanguage } = useLanguagePreference();
  const copy = i18n[language].aboutPage;
  const siteCopy = i18n[language].site;

  const cards = [
    [copy.whatTitle, copy.whatBody],
    [copy.audienceTitle, copy.audienceBody],
    [copy.sourcesTitle, copy.sourcesBody],
  ];

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
            <div className="max-w-3xl self-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]"
              >
                RentScout
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="mt-6 text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl lg:text-6xl"
              >
                {copy.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg"
              >
                {copy.subtitle}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <Link
                  href="/search?setup=1"
                  className="rs-primary-button inline-flex h-12 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {copy.startSearch}
                </Link>
                <Link
                  href="/account"
                  className="rs-control inline-flex h-12 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {siteCopy.nav.account}
                </Link>
              </motion.div>
            </div>

            <Reveal>
              <div className="rs-card rounded-[1.5rem] p-5">
                <div className="rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        {copy.workflowTitle}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-muted)]">
                        {copy.workflowSubtitle}
                      </div>
                    </div>
                    <span className="rs-chip-positive rounded-full px-3 py-1 text-xs font-semibold">
                      {copy.workflowBadge}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {copy.how.map((item, index) => (
                      <div
                        key={item}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] p-4"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-strong)]">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {cards.map(([title, body], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <article className="rs-card-solid h-full rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-hover)]">
                  <div className="mb-4 h-2 w-12 rounded-full bg-[var(--color-accent)]" />
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-band)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.42fr_1fr] lg:px-8">
            <Reveal>
              <div>
                <p className="text-sm font-semibold text-[var(--color-accent-strong)]">
                  {copy.howTitle}
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-[var(--color-text)]">
                  {copy.sequenceTitle}
                </h2>
              </div>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-3">
              {copy.how.map((item, index) => (
                <Reveal key={item} delay={index * 0.06}>
                  <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent-strong)]">
                      {index + 1}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{item}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-premium)] sm:p-8">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">{copy.contactTitle}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
                {copy.contactBody}
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  );
}

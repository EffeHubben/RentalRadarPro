"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

export type InfoSection = {
  title: string;
  body: string[];
};

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
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.42, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function InfoPageLayout({
  eyebrow,
  title,
  intro,
  sections,
  asideTitle,
  asideBody,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
  asideTitle?: string;
  asideBody?: string[];
  children?: React.ReactNode;
}) {
  const { language, changeLanguage } = useLanguagePreference();

  return (
    <div className="min-h-[100dvh] bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]"
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl"
            >
              {title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg"
            >
              {intro}
            </motion.p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.4fr]">
            <div className="space-y-4">
              {sections.map((section, index) => (
                <Reveal key={section.title} delay={index * 0.045}>
                  <article className="rs-card-solid rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-hover)]">
                    <div className="mb-4 h-1 w-10 rounded-full bg-[var(--color-accent)]" />
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-muted)]">
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>

            <aside>
              <div className="sticky top-6 space-y-4">
                {asideTitle && asideBody ? (
                  <Reveal>
                    <div className="rs-card-solid rounded-2xl p-6">
                      <div className="mb-4 h-1 w-10 rounded-full bg-[var(--color-accent)]" />
                      <h2 className="text-base font-semibold text-[var(--color-text)]">
                        {asideTitle}
                      </h2>
                      <ul className="mt-4 space-y-3">
                        {asideBody.map((point) => (
                          <li
                            key={point}
                            className="flex gap-3 text-sm leading-6 text-[var(--color-muted)]"
                          >
                            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                ) : null}
                {children}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  );
}

export function languageRecord<T>(nl: T, en: T): Record<Language, T> {
  return { nl, en };
}

"use client";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

export type InfoSection = {
  title: string;
  body: string[];
};

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
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {eyebrow}
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {intro}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              {sections.map((section) => (
                <article key={section.title} className="rs-card rounded-[1.5rem] p-6">
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">{section.title}</h2>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-muted)]">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <aside className="space-y-5">
              {asideTitle && asideBody ? (
                <div className="rs-card rounded-[1.5rem] p-6">
                  <h2 className="text-xl font-semibold text-[var(--color-text)]">{asideTitle}</h2>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-muted)]">
                    {asideBody.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              {children}
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

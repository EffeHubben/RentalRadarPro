"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const onboardingStorageKey = "rental-radar-onboarding-complete-v1";

export default function HomePage() {
  const { language, changeLanguage } = useLanguagePreference();
  const [hasPreviousSearch, setHasPreviousSearch] = useState(false);
  const copy = i18n[language].home;

  useEffect(() => {
    setHasPreviousSearch(window.localStorage.getItem(onboardingStorageKey) === "done");
  }, []);

  return (
    <div className="min-h-screen bg-[#070a10] text-cream">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brass">
              {copy.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
              {copy.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/search?setup=1"
                className="inline-flex h-11 items-center rounded-lg bg-brass px-5 text-sm font-semibold text-ink transition hover:bg-[#e3bd6a]"
              >
                {copy.startSearch}
              </Link>
              {hasPreviousSearch ? (
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center rounded-lg border border-white/12 bg-white/[0.045] px-5 text-sm font-semibold text-white/72 transition hover:border-white/24 hover:text-white"
                >
                  {copy.continueSearch}
                </Link>
              ) : null}
              <Link
                href="/about"
                className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-white/58 transition hover:text-white"
              >
                {copy.learnMore}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-premium">
            <div className="rounded-xl bg-[#10151d] p-4">
              <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
                <span className="text-sm font-semibold text-white">Breda</span>
                <span className="text-xs text-mint">Recent</span>
              </div>
              {[
                ["Studio centrum", "EUR 706", "24 m2"],
                ["Appartement station", "EUR 1.625", "82 m2"],
                ["Kamer Ginneken", "EUR 585", "30 m2"],
              ].map(([title, price, area]) => (
                <div key={title} className="flex items-center justify-between border-b border-white/8 py-3 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-white">{title}</div>
                    <div className="mt-1 text-xs text-white/42">Marktplaats · Funda</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{price}</div>
                    <div className="mt-1 text-xs text-white/42">{area}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/8 bg-white/[0.025]">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
            {copy.benefits.map((benefit) => (
              <div key={benefit} className="text-sm leading-6 text-white/62">
                <div className="mb-3 h-px w-10 bg-brass" />
                {benefit}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1fr]">
            <h2 className="text-3xl font-semibold text-white">{copy.stepsTitle}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {copy.steps.map((step, index) => (
                <article key={step.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="text-xs font-semibold text-brass">{String(index + 1).padStart(2, "0")}</div>
                  <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/52">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-white">{copy.featuresTitle}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {copy.features.map((feature) => (
              <div key={feature} className="rounded-lg border border-white/10 bg-black/18 px-4 py-3 text-sm font-medium text-white/70">
                {feature}
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  );
}

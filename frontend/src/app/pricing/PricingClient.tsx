"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { languageRecord } from "@/components/site/InfoPageLayout";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

const copy = languageRecord(
  {
    eyebrow: "Abonnementen",
    title: "Eenvoudig beginnen, altijd gratis.",
    intro:
      "Start gratis en upgrade naar Pro wanneer je meer nodig hebt. RentScout Pro is een digitaal SaaS-abonnement voor serieuze woningzoekers.",
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
    billingNote: "Abonnementen worden verwerkt via Paddle. Op elk moment opzegbaar.",
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
        q: "Hoe kan ik annuleren?",
        a: "Je kunt je abonnement op elk moment opzeggen via je accountpagina. Na opzegging stopt de verlenging en blijft Pro actief tot het einde van de betaalperiode.",
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
      "Begin for free and upgrade to Pro when you need more. RentScout Pro is a digital SaaS subscription for serious renters.",
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
    billingNote: "Subscriptions are processed through Paddle. Cancel at any time.",
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
        q: "How do I cancel?",
        a: "You can cancel your subscription at any time from your account page. After cancellation, renewal stops and Pro remains active until the end of the billing period.",
      },
      {
        q: "Who handles the payment?",
        a: "Payments for RentScout Pro are processed by Paddle. RentScout does not store full payment details itself.",
      },
    ],
  },
);

export default function PricingClient() {
  const { language, changeLanguage } = useLanguagePreference();
  const c = copy[language as Language];

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

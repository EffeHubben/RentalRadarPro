"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { i18n } from "@/lib/i18n";
import {
  buildSearchHref,
  getNearbyLandingLinks,
  getSafePreviewListings,
  getTypeLandingLinks,
  type SeoLandingConfig,
} from "@/lib/seo/landings";
import { useLanguagePreference } from "@/lib/useLanguagePreference";

function propertyTypeLabel(propertyType: "apartment" | "room" | "studio", language: "nl" | "en"): string {
  const copy = i18n[language].propertyTypes;
  if (propertyType === "apartment") return copy.apartment;
  if (propertyType === "room") return copy.room;
  return copy.studio;
}

function formatPrice(price: number, language: "nl" | "en"): string {
  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function SeoLandingClient({ landing }: { landing: SeoLandingConfig }) {
  const { language, changeLanguage } = useLanguagePreference();
  const siteCopy = i18n[language].site;
  const searchHref = buildSearchHref(landing.ctaSearchFilters);
  const nearbyCityLinks = getNearbyLandingLinks(landing.city);
  const typeLinks = getTypeLandingLinks(landing.city);
  const previewListings = getSafePreviewListings(landing.city, landing.ctaSearchFilters.propertyType);
  const h1 = landing.title.replace(" | RentScout", "");
  const trustLine =
    language === "nl"
      ? "Publieke preview: maximaal 10 listings met alleen prijs, locatie en woningtype."
      : "Public preview: up to 10 listings showing only price, location, and property type.";

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_72%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              RentScout
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl">
              {h1}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {landing.introText}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={searchHref}
                className="rs-primary-button inline-flex h-12 items-center rounded-lg px-5 text-sm font-semibold"
              >
                {language === "nl" ? `Bekijk listings in ${landing.city.cityName}` : `View listings in ${landing.city.cityName}`}
              </Link>
              <Link
                href="/#pricing"
                className="rs-control inline-flex h-12 items-center rounded-lg px-5 text-sm font-semibold"
              >
                {language === "nl" ? "Bekijk Pro Pass" : "View Pro Pass"}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {previewListings.map((listing, index) => (
              <article
                key={`${listing.city}-${listing.location}-${listing.propertyType}-${index}`}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent-strong)]">
                  {propertyTypeLabel(listing.propertyType as "apartment" | "room" | "studio", language)}
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                  {formatPrice(listing.price, language)}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  {listing.city} · {listing.location}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--color-subtle)]">{trustLine}</p>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-band)]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">
              {language === "nl" ? "Waarom zoeken met RentScout?" : "Why search with RentScout?"}
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {landing.benefits.map((benefit) => (
                <li key={benefit} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm leading-7 text-[var(--color-muted)]">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                {language === "nl" ? "Veelgestelde vragen" : "FAQ"}
              </h2>
              <div className="mt-5 space-y-4">
                {landing.faq.map((item) => (
                  <div key={item.question}>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">{item.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.answer}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                {language === "nl" ? "Verken meer steden en woningtypes" : "Explore nearby cities and property types"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {language === "nl"
                  ? `Provincie: ${landing.city.province}. Populaire budgetranges: ${landing.suggestedBudgetRanges.join(", ")}.`
                  : `Province: ${landing.city.province}. Suggested budget ranges: ${landing.suggestedBudgetRanges.join(", ")}.`}
              </p>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {language === "nl" ? "Steden in de buurt" : "Nearby cities"}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nearbyCityLinks.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/${item.slug}`}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-page)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                    >
                      {item.cityName}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {language === "nl" ? "Woningtype pagina's" : "Property type pages"}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeLinks.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/${item.slug}`}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-page)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <Link
                  href={searchHref}
                  className="rs-primary-button inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {language === "nl" ? "Open zoekwerkruimte" : "Open search workspace"}
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { fetchListingById } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import type { Language } from "@/lib/i18n";
import { i18n } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import type { Listing } from "@/types/listing";

function extractListingId(slug: string): number | null {
  const id = parseInt(slug.split("-")[0], 10);
  return isNaN(id) ? null : id;
}

function formatPrice(price: number | null | undefined, lang: Language): string {
  if (!price) return lang === "nl" ? "Prijs onbekend" : "Price unknown";
  return `€ ${price.toLocaleString(lang === "nl" ? "nl-NL" : "en-GB")} / mo`;
}

function formatArea(area: number | null | undefined, lang: Language): string {
  if (!area) return lang === "nl" ? "Onbekend" : "Unknown";
  return `${area} m²`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ListingJsonLd({ listing, slug }: { listing: Listing; slug: string }) {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://rentscout.nl";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    url: `${appUrl}/listing/${slug}`,
    name:
      listing.title ||
      [
        listing.property_type !== "unknown" ? capitalize(listing.property_type) : null,
        listing.city,
      ]
        .filter(Boolean)
        .join(" in ") ||
      "Rental listing",
  };

  if (listing.city) {
    schema["address"] = {
      "@type": "PostalAddress",
      addressLocality: listing.city,
      addressCountry: "NL",
    };
  }

  if (listing.price) {
    schema["offers"] = {
      "@type": "Offer",
      price: String(listing.price),
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(listing.price),
        priceCurrency: "EUR",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: "1",
          unitCode: "MON",
        },
      },
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ListingDetailClient({ slug }: { slug: string }) {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const listingCopy = i18n[language].listing;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listingId = extractListingId(slug);

  const isPro = Boolean(auth.user && auth.user.plan === "pro" && auth.user.subscription_status === "active");
  const isPreview = !isPro;

  useEffect(() => {
    if (!listingId) {
      setError("Invalid listing");
      setLoading(false);
      return;
    }

    const token = auth.accessToken ?? undefined;
    fetchListingById(listingId, token)
      .then((data) => {
        setListing(data as Listing);
        trackEvent("listing_view", {
          listing_id: listingId,
          city: (data as Listing).city ?? undefined,
          path: `/listing/${slug}`,
        });
      })
      .catch(() => setError(language === "nl" ? "Advertentie niet gevonden." : "Listing not found."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, auth.accessToken]);

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      {listing && <ListingJsonLd listing={listing} slug={slug} />}
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/search"
            className="text-sm font-semibold text-[var(--color-accent-strong)] hover:text-[var(--color-text)]"
          >
            ← {language === "nl" ? "Terug naar zoeken" : "Back to search"}
          </Link>
        </div>

        {loading && (
          <div className="rs-card rounded-[1.5rem] p-8 text-center text-sm text-[var(--color-muted)]">
            {language === "nl" ? "Advertentie laden…" : "Loading listing…"}
          </div>
        )}

        {!loading && error && (
          <div className="rs-card rounded-[1.5rem] p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">{error}</p>
            <Link
              href="/search"
              className="mt-4 inline-flex rs-primary-button h-10 items-center rounded-lg px-4 text-sm font-semibold"
            >
              {language === "nl" ? "Ga naar zoeken" : "Go to search"}
            </Link>
          </div>
        )}

        {!loading && listing && (
          <div className="space-y-5">
            {/* Image */}
            {listing.image_url && (
              <div className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.image_url}
                  alt={listing.title || listing.city || "Rental listing"}
                  className="h-72 w-full object-cover sm:h-96"
                  loading="eager"
                />
              </div>
            )}

            {/* Header */}
            <div className="rs-card rounded-[1.5rem] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  {listing.title && !isPreview ? (
                    <h1 className="text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
                      {listing.title}
                    </h1>
                  ) : (
                    <h1 className="text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
                      {[
                        listing.property_type !== "unknown"
                          ? capitalize(listing.property_type)
                          : null,
                        listing.city,
                      ]
                        .filter(Boolean)
                        .join(language === "nl" ? " in " : " in ") || "Rental listing"}
                    </h1>
                  )}
                  <p className="mt-2 text-lg font-semibold text-[var(--color-accent-strong)]">
                    {formatPrice(listing.price, language)}
                  </p>
                </div>

                {!isPreview && listing.url && listing.url !== "#" && (
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      trackEvent("open_listing_click", {
                        listing_id: listingId ?? undefined,
                        city: listing.city ?? undefined,
                      })
                    }
                    className="rs-primary-button inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold"
                  >
                    {listingCopy.openAd}
                  </a>
                )}
              </div>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: language === "nl" ? "Stad" : "City",
                  value: listing.city || (language === "nl" ? "Onbekend" : "Unknown"),
                },
                {
                  label: language === "nl" ? "Type" : "Type",
                  value:
                    listing.property_type !== "unknown"
                      ? capitalize(listing.property_type)
                      : language === "nl"
                        ? "Onbekend"
                        : "Unknown",
                },
                ...(!isPreview
                  ? [
                      {
                        label: language === "nl" ? "Oppervlakte" : "Area",
                        value: formatArea(listing.area_m2, language),
                      },
                      {
                        label: language === "nl" ? "Kamers" : "Rooms",
                        value: listing.rooms != null ? String(listing.rooms) : language === "nl" ? "Onbekend" : "Unknown",
                      },
                    ]
                  : []),
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rs-card rounded-xl p-4 text-sm"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                    {label}
                  </div>
                  <div className="mt-2 font-semibold text-[var(--color-text)]">{value}</div>
                </div>
              ))}
            </div>

            {/* Description - Pro only */}
            {!isPreview && listing.description && (
              <div className="rs-card rounded-[1.5rem] p-6">
                <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">
                  {language === "nl" ? "Beschrijving" : "Description"}
                </h2>
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--color-muted)]">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Pro gate */}
            {isPreview && (
              <div className="rs-card rounded-[1.5rem] p-6 text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {language === "nl"
                    ? "Upgrade naar Pro voor volledige woningdetails, adres, oppervlakte, kamers en directe link naar de advertentie."
                    : "Upgrade to Pro for full listing details, address, area, rooms, and a direct link to the source listing."}
                </p>
                <Link
                  href="/account"
                  className="mt-4 inline-flex rs-primary-button h-10 items-center rounded-lg px-4 text-sm font-semibold"
                >
                  {language === "nl" ? "Upgrade naar Pro" : "Upgrade to Pro"}
                </Link>
              </div>
            )}

            {/* Source - Pro only */}
            {!isPreview && listing.source && (
              <div className="rs-card rounded-[1.5rem] p-6">
                <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">
                  {language === "nl" ? "Bron" : "Source"}
                </h2>
                <p className="text-sm text-[var(--color-muted)]">{listing.source}</p>
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter language={language} />
    </div>
  );
}

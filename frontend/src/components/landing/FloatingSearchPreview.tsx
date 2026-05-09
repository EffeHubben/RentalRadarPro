"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Language } from "@/lib/i18n";

interface FloatingSearchPreviewProps {
  language: Language;
  size?: "hero" | "story";
}

const TYPES_NL = ["Appartement", "Studio", "Woning"];
const TYPES_EN = ["Apartment", "Studio", "House"];

export function FloatingSearchPreview({ language, size = "story" }: FloatingSearchPreviewProps) {
  const shouldReduceMotion = useReducedMotion();
  const isNl = language === "nl";
  const types = isNl ? TYPES_NL : TYPES_EN;
  const isHero = size === "hero";

  const listings = isNl
    ? [
        {
          title: "Appartement bij het station",
          meta: "Amsterdam · 68 m² · 2 kamers",
          price: "€1.275",
          label: "Nieuwe match",
        },
        {
          title: "Studio met eigen keuken",
          meta: "Amsterdam · 34 m² · beschikbaar",
          price: "€985",
          label: "Sterke match",
        },
        {
          title: "Rustig appartement met balkon",
          meta: "Utrecht · 55 m² · morgen vrij",
          price: "€1.190",
          label: "Bewaard",
        },
      ]
    : [
        {
          title: "Apartment near the station",
          meta: "Amsterdam · 68 m² · 2 rooms",
          price: "€1,275",
          label: "New match",
        },
        {
          title: "Studio with private kitchen",
          meta: "Amsterdam · 34 m² · available",
          price: "€985",
          label: "Strong match",
        },
        {
          title: "Quiet apartment with balcony",
          meta: "Utrecht · 55 m² · opens tomorrow",
          price: "€1,190",
          label: "Saved",
        },
      ];

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { rotateY: -2, rotateX: 1.5, scale: 1.012 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      style={{ perspective: 1100, transformStyle: "preserve-3d" }}
      className={`relative mx-auto w-full ${isHero ? "max-w-[660px]" : "max-w-[600px]"}`}
    >
      <div
        aria-hidden
        className="absolute inset-x-8 bottom-[-8%] h-20 rounded-full bg-[var(--color-teal-soft)]"
        style={{ filter: "blur(28px)" }}
      />

      <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 shadow-[var(--shadow-premium)] backdrop-blur-2xl sm:p-4">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.34), transparent 34%), radial-gradient(circle at 14% 0%, var(--color-accent-soft), transparent 18rem)",
          }}
        />

        <div className="relative rounded-[1.45rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-subtle)]">
                RentScout
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--color-text)] sm:text-2xl">
                {isNl ? "Slim zoeken" : "Smart search"}
              </h2>
            </div>
            <div className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {isNl ? "Nieuwe match" : "New match"}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2 shadow-[var(--shadow-soft)]">
            <div className="grid gap-2 sm:grid-cols-[1.25fr_0.9fr_0.9fr]">
              <div className="rounded-xl bg-[var(--color-soft)] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                  {isNl ? "Zoeken in" : "Search in"}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">Amsterdam</div>
              </div>
              <div className="rounded-xl bg-[var(--color-soft)] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                  Budget
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">max €1.500</div>
              </div>
              <div className="rounded-xl bg-[var(--color-soft)] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                  {isNl ? "Type" : "Type"}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                  {isNl ? "Appartement" : "Apartment"}
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {types.map((type, index) => (
                <span
                  key={type}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${index === 0 ? "rs-chip-active" : "rs-chip"}`}
                >
                  {type}
                </span>
              ))}
              <span className="rs-chip-positive rounded-full px-3 py-1 text-xs font-medium">
                {isNl ? "Eigen keuken" : "Private kitchen"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {listings.map((listing, index) => (
              <motion.article
                key={listing.title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, delay: 0.12 + index * 0.08 }}
                className="grid grid-cols-[3.4rem_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 shadow-[var(--shadow-soft)]"
              >
                <div
                  aria-hidden
                  className="h-12 rounded-xl"
                  style={{
                    background:
                      index === 0
                        ? "linear-gradient(135deg, var(--color-teal-soft), var(--color-accent-soft))"
                        : "linear-gradient(135deg, var(--color-soft), var(--color-teal-soft))",
                  }}
                />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{listing.title}</h3>
                  <p className="truncate text-xs text-[var(--color-muted)]">{listing.meta}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--color-text)]">{listing.price}</p>
                  <span className="mt-1 inline-flex rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-strong)]">
                    {listing.label}
                  </span>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <motion.span
                animate={shouldReduceMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [1, 1.2, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="h-2 w-2 rounded-full bg-[var(--color-teal)]"
              />
              <span className="text-xs font-medium text-[var(--color-muted)]">
                {isNl ? "Meerdere bronnen live bijgewerkt" : "Multiple sources updated live"}
              </span>
            </div>
            <span className="text-xs font-semibold text-[var(--color-accent-strong)]">
              {isNl ? "12 matches" : "12 matches"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

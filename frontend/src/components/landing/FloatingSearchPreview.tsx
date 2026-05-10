"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Language } from "@/lib/i18n";

const TYPES_NL = ["Appartement", "Studio", "+2 meer"];
const TYPES_EN = ["Apartment", "Studio", "+2 more"];
const PRIVACY_NL = ["Eigen keuken", "Eigen badkamer"];
const PRIVACY_EN = ["Private kitchen", "Private bathroom"];

export function FloatingSearchPreview({ language }: { language: Language }) {
  const shouldReduceMotion = useReducedMotion();
  const isNl = language === "nl";

  const types = isNl ? TYPES_NL : TYPES_EN;
  const privacy = isNl ? PRIVACY_NL : PRIVACY_EN;

  const listings = isNl
    ? [
        { title: "Appartement bij het station", meta: "Amsterdam · 68 m² · 2 kamers", price: "€1.275", label: "Sterke match" },
        { title: "Studio in het centrum", meta: "Amsterdam · 34 m² · eigen keuken", price: "€985", label: "Nieuw" },
        { title: "Rustig 2-kamerappartement", meta: "Amsterdam · 55 m² · beschikbaar", price: "€1.190", label: "Bewaard" },
      ]
    : [
        { title: "Apartment near the station", meta: "Amsterdam · 68 m² · 2 rooms", price: "€1,275", label: "Strong match" },
        { title: "Studio in the city centre", meta: "Amsterdam · 34 m² · private kitchen", price: "€985", label: "New" },
        { title: "Quiet 2-room apartment", meta: "Amsterdam · 55 m² · available", price: "€1,190", label: "Saved" },
      ];

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { rotateY: 2, rotateX: -1.5, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ perspective: 900, transformStyle: "preserve-3d" }}
      className="w-full max-w-sm"
    >
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-premium)]">
        {/* Search inputs */}
        <div className="flex overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex-1 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
              {isNl ? "Stad" : "City"}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">Amsterdam</div>
          </div>
          <div className="w-px bg-[var(--color-border)]" />
          <div className="flex-1 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
              Budget
            </div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">max €1.500</div>
          </div>
        </div>

        {/* Type chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {types.map((t, i) => (
            <span
              key={t}
              className={`rounded-full px-3 py-1 text-xs font-medium ${i === 0 ? "rs-chip-active" : "rs-chip"}`}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Privacy chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {privacy.map((p) => (
            <span key={p} className="rs-chip-positive rounded-full px-3 py-1 text-xs font-medium">
              {p}
            </span>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-[var(--color-border)]" />

        {/* Result preview */}
        <div className="space-y-2">
          {listings.map((listing, i) => (
            <motion.div
              key={listing.title}
              initial={shouldReduceMotion ? false : { opacity: 0, x: i % 2 === 0 ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-page)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[var(--color-text)]">{listing.title}</div>
                <div className="truncate text-[10px] text-[var(--color-muted)]">{listing.meta}</div>
              </div>
              <div className="ml-3 shrink-0 text-right">
                <div className="text-xs font-bold text-[var(--color-text)]">{listing.price}</div>
                <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent-strong)]">
                  {listing.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Live badge */}
        <div className="mt-3 flex items-center gap-2">
          <motion.span
            animate={shouldReduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]"
          />
          <span className="text-xs text-[var(--color-muted)]">
            {isNl ? "Live bijgewerkt · Funda & Pararius" : "Live updated · Funda & Pararius"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

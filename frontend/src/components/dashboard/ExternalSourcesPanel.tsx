"use client";

import { motion } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import type { SourceInfo } from "@/types/listing";

function buildExternalUrl(source: SourceInfo, city: string): string | null {
  if (source.manual_search_url && (!city || !source.manual_search_url_template)) {
    return source.manual_search_url;
  }

  const template = source.manual_search_url_template ?? source.manual_search_url ?? source.base_url;
  if (!template) {
    return null;
  }

  if (template.includes("{city}") && city) {
    const slug = encodeURIComponent(city.trim().toLowerCase().replace(/\s+/g, "-"));
    return template.replace("{city}", slug);
  }

  return template;
}

export function ExternalSourcesPanel({
  sources,
  city,
  language,
  isProUser,
  freeLimit = 4,
}: {
  sources: SourceInfo[];
  city: string;
  language: Language;
  isProUser: boolean;
  freeLimit?: number;
}) {
  const copy = i18n[language].dashboard;

  const ranked = [...sources]
    .filter((source) => source.enabled !== false)
    .filter((source) => !source.auto_scan_enabled || source.status === "limited")
    .filter((source) => {
      if (!source.supported_cities || source.supported_cities.length === 0) {
        return true;
      }
      if (!city) {
        return true;
      }
      return source.supported_cities.some(
        (supportedCity) => supportedCity.toLowerCase() === city.trim().toLowerCase(),
      );
    })
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));

  if (!ranked.length) {
    return null;
  }

  const visible = isProUser ? ranked : ranked.slice(0, freeLimit);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="dashboard-shell mt-6 rounded-2xl p-5"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {copy.externalSourcesTitle}
        </h3>
        <p className="rs-muted mt-1 text-sm leading-6">{copy.externalSourcesSubtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((source) => {
          const externalUrl = buildExternalUrl(source, city);
          const badges: string[] = [];

          if (source.source_type === "manual" || source.status === "manual") {
            badges.push(copy.externalSourceManual);
          } else if (source.status === "limited") {
            badges.push(copy.externalSourceLimited);
          }

          if (source.likely_blocks_bots) {
            badges.push(copy.externalSourceNotAuto);
          }

          if (
            source.internal_reason?.toLowerCase().includes("login") ||
            source.internal_reason?.toLowerCase().includes("registr") ||
            source.internal_reason?.toLowerCase().includes("passend") ||
            source.internal_reason?.toLowerCase().includes("paid")
          ) {
            badges.push(copy.externalSourceLoginNeeded);
          }

          return (
            <a
              key={source.source_id}
              href={externalUrl ?? source.base_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rs-control flex flex-col gap-2 rounded-xl px-3 py-3 text-left transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {source.display_name}
                </span>
                <span className="rs-subtle text-xs">→</span>
              </div>
              {badges.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rs-chip rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              <span className="rs-muted text-xs leading-5">
                {source.notes}
              </span>
              <span className="rs-subtle text-xs">{copy.externalSourceOpen}</span>
            </a>
          );
        })}
      </div>
    </motion.section>
  );
}

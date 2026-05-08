"use client";

import { motion } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";
import type { SourceInfo } from "@/types/listing";

const cityRegions: Record<string, string[]> = {
  amsterdam: ["Noord-Holland", "Randstad"],
  rotterdam: ["Zuid-Holland", "Randstad", "Rijnmond"],
  "den haag": ["Zuid-Holland", "Randstad", "Haaglanden"],
  utrecht: ["Utrecht", "Randstad"],
  eindhoven: ["Noord-Brabant", "Zuidoost-Brabant"],
  tilburg: ["Noord-Brabant"],
  breda: ["Noord-Brabant", "West-Brabant"],
  "den bosch": ["Noord-Brabant"],
  nijmegen: ["Gelderland", "Arnhem-Nijmegen"],
  arnhem: ["Gelderland", "Arnhem-Nijmegen"],
  groningen: ["Groningen"],
  maastricht: ["Limburg"],
  leiden: ["Zuid-Holland", "Randstad"],
  delft: ["Zuid-Holland", "Randstad", "Haaglanden"],
  haarlem: ["Noord-Holland", "Randstad"],
  almere: ["Flevoland", "Randstad"],
  amersfoort: ["Utrecht"],
  apeldoorn: ["Gelderland", "Stedendriehoek"],
  enschede: ["Overijssel"],
  zwolle: ["Overijssel"],
  dordrecht: ["Zuid-Holland", "Rijnmond"],
  zoetermeer: ["Zuid-Holland", "Randstad", "Haaglanden"],
  "etten-leur": ["Noord-Brabant", "West-Brabant"],
  roosendaal: ["Noord-Brabant", "West-Brabant"],
  "bergen op zoom": ["Noord-Brabant", "West-Brabant"],
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

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

function sourceSupportsCity(source: SourceInfo, city: string) {
  const normalizedCity = normalize(city);
  if (!normalizedCity || !source.supported_cities?.length) {
    return false;
  }
  return source.supported_cities.some((supportedCity) => normalize(supportedCity) === normalizedCity);
}

function sourceSupportsRegion(source: SourceInfo, city: string) {
  const regions = cityRegions[normalize(city)] ?? [];
  if (!regions.length || !source.supported_regions?.length) {
    return false;
  }
  const sourceRegions = source.supported_regions.map(normalize);
  return regions.some((region) => sourceRegions.includes(normalize(region)));
}

function relevanceScore(source: SourceInfo, city: string) {
  const citySelected = Boolean(city.trim());
  const cityMatch = sourceSupportsCity(source, city);
  const regionMatch = sourceSupportsRegion(source, city);
  const national = !source.supported_cities?.length && !source.supported_regions?.length;
  const statusScore = source.status === "manual" ? 8 : source.status === "limited" ? 12 : 6;
  const typeScore =
    source.category === "marketplace"
      ? 10
      : source.category === "landlord"
        ? 8
        : source.category === "housing-corporation"
          ? 7
          : 5;

  if (!citySelected) {
    return (national ? 80 : regionMatch ? 50 : 35) + typeScore + statusScore + (source.priority ?? 0);
  }

  return (
    (cityMatch ? 130 : regionMatch ? 85 : national ? 55 : 0)
    + typeScore
    + statusScore
    + (source.priority ?? 0)
  );
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
      if (!city) {
        return true;
      }
      if (!source.supported_cities?.length && !source.supported_regions?.length) {
        return true;
      }
      return sourceSupportsCity(source, city) || sourceSupportsRegion(source, city);
    })
    .sort((left, right) => {
      const scoreDiff = relevanceScore(right, city) - relevanceScore(left, city);
      if (scoreDiff !== 0) return scoreDiff;
      return left.display_name.localeCompare(right.display_name);
    });

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

          if (!source.auto_scan_enabled || source.likely_blocks_bots) {
            badges.push(copy.externalSourceNotAuto);
          }

          if (
            source.requires_login ||
            source.internal_reason?.toLowerCase().includes("login") ||
            source.internal_reason?.toLowerCase().includes("registr") ||
            source.internal_reason?.toLowerCase().includes("passend") ||
            source.internal_reason?.toLowerCase().includes("paid")
          ) {
            badges.push(copy.externalSourceLoginNeeded);
          }

          if (sourceSupportsCity(source, city)) {
            badges.push(copy.externalSourceCityMatch);
          } else if (sourceSupportsRegion(source, city)) {
            badges.push(copy.externalSourceRegionMatch);
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

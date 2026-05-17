"use client";

import { i18n, type Language } from "@/lib/i18n";

const RADIUS_OPTIONS = [5, 10, 20, 30, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

type Props = {
  value: number;
  language: Language;
  onChange: (km: number) => void;
};

export function RadiusSelector({ value, language, onChange }: Props) {
  const copy = i18n[language].filters;

  return (
    <div>
      <span className="rs-subtle mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em]">
        {copy.radiusLabel}
      </span>
      <div className="flex flex-wrap gap-2">
        {RADIUS_OPTIONS.map((km) => (
          <button
            key={km}
            type="button"
            onClick={() => onChange(km)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              value === km
                ? "bg-[var(--color-accent)] text-white"
                : "rs-chip"
            }`}
          >
            {km} km
          </button>
        ))}
      </div>
    </div>
  );
}

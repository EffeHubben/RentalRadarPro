"use client";

import { motion } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";

export function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
        >
          <div className="h-56 animate-shimmer bg-[linear-gradient(110deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))] bg-[length:200%_100%]" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded bg-white/8" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 animate-pulse rounded-xl bg-white/8" />
              <div className="h-16 animate-pulse rounded-xl bg-white/8" />
              <div className="h-16 animate-pulse rounded-xl bg-white/8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  onRunScraper,
  language,
}: {
  onRunScraper: () => void;
  language: Language;
}) {
  const copy = i18n[language].empty;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/[0.045] p-10 text-center shadow-premium"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-brass/30 bg-brass/10 text-xl font-semibold text-brass">
        RR
      </div>
      <h2 className="text-2xl font-semibold text-white">{copy.title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/52">
        {copy.body}
      </p>
      <button
        type="button"
        onClick={onRunScraper}
        className="mt-6 rounded-xl border border-brass/45 bg-brass px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#e6bd68]"
      >
        {copy.action}
      </button>
    </motion.section>
  );
}

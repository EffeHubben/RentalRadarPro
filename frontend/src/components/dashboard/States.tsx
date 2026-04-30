"use client";

import { motion, useReducedMotion } from "framer-motion";
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
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="cinematic-panel rounded-3xl border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.095),rgba(8,13,24,0.78)_52%,rgba(6,10,18,0.92))] p-6 text-center shadow-cinematic backdrop-blur-2xl sm:p-10"
    >
      <div className="relative z-10 mx-auto max-w-xl">
        <motion.div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-cyan-100/20 bg-cyan-300/10 shadow-[0_0_70px_rgba(34,211,238,0.20)]"
          animate={shouldReduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-10 w-10 rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.68),rgba(125,211,252,0.28)_30%,rgba(14,165,233,0.08)_70%)]" />
        </motion.div>
        <div className="mx-auto mb-3 h-px w-44 bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-white sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/62">
          {copy.body}
        </p>
        <button
          type="button"
          onClick={onRunScraper}
          className="mt-7 rounded-2xl border border-cyan-100/45 bg-cyan-100 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_22px_70px_rgba(34,211,238,0.22)] transition hover:bg-white"
        >
          {copy.action}
        </button>
      </div>
    </motion.section>
  );
}

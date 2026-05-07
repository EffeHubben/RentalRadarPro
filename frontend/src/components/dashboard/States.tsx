"use client";

import { motion, useReducedMotion } from "framer-motion";
import { i18n, type Language } from "@/lib/i18n";

export function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="h-56 animate-shimmer bg-[linear-gradient(110deg,var(--color-soft),var(--color-surface-elevated),var(--color-soft))] bg-[length:200%_100%]" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-soft)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--color-soft)]" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 animate-pulse rounded-xl bg-[var(--color-soft)]" />
              <div className="h-16 animate-pulse rounded-xl bg-[var(--color-soft)]" />
              <div className="h-16 animate-pulse rounded-xl bg-[var(--color-soft)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  language,
}: {
  language: Language;
}) {
  const copy = i18n[language].empty;
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rs-card rounded-3xl p-6 text-center sm:p-10"
    >
      <div className="relative z-10 mx-auto max-w-xl">
        <motion.div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-teal-soft)]"
          animate={shouldReduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-10 w-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
        </motion.div>
        <div className="mx-auto mb-3 h-px w-44 bg-gradient-to-r from-transparent via-[var(--color-border-strong)] to-transparent" />
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--color-text)] sm:text-3xl">
          {copy.title}
        </h2>
        <p className="rs-muted mx-auto mt-3 max-w-md text-sm leading-6">
          {copy.body}
        </p>
      </div>
    </motion.section>
  );
}

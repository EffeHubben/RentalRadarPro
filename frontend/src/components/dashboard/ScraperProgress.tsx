"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { ScraperResult } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";

const stageThresholds = [0, 18, 38, 62, 82];
type SourceRun = ScraperResult["sources"][number];

function statusForSource(source: SourceRun) {
  return source.status ?? (source.error ? "failed" : "success");
}

export function ScraperProgress({
  loading,
  result,
  language,
  automatic = false,
}: {
  loading: boolean;
  result: ScraperResult | null;
  language: Language;
  automatic?: boolean;
}) {
  const copy = i18n[language].scraper;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setCompleting(false);
    setElapsedSeconds(0);

    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (loading || !result) {
      return;
    }

    setCompleting(true);
    const timeout = window.setTimeout(() => {
      setCompleting(false);
      setElapsedSeconds(0);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [loading, result]);

  const progress = completing
    ? 100
    : Math.min(96, Math.round(8 + elapsedSeconds * 1.8));
  const activeStage = useMemo(() => {
    const stageIndex = stageThresholds.reduce((currentIndex, threshold, index) => {
      return progress >= threshold ? index : currentIndex;
    }, 0);
    return Math.min(copy.steps.length - 1, Math.max(0, stageIndex));
  }, [copy.steps.length, progress]);

  const activeMessage = copy.statusMessages[
    Math.floor(elapsedSeconds / 7) % copy.statusMessages.length
  ];
  const successfulSources = result?.sources.filter(
    (source) => statusForSource(source) === "success",
  ) ?? [];
  const attentionSources = result?.sources.filter(
    (source) => statusForSource(source) !== "success",
  ) ?? [];
  const blockedCount = result?.sources.filter(
    (source) => statusForSource(source) === "blocked" || statusForSource(source) === "failed",
  ).length ?? 0;
  const noResultCount = result?.sources.filter(
    (source) => statusForSource(source) === "no_results",
  ).length ?? 0;
  const summaryParts = [
    successfulSources.length
      ? `${successfulSources.length} ${
          successfulSources.length === 1 ? copy.successfulSource : copy.successfulSources
        }`
      : null,
    blockedCount
      ? `${blockedCount} ${blockedCount === 1 ? copy.blockedSource : copy.blockedSources}`
      : null,
    noResultCount
      ? `${noResultCount} ${
          noResultCount === 1 ? copy.noResultSource : copy.noResultSources
        }`
      : null,
  ].filter(Boolean);

  if (!loading && !result) {
    return null;
  }

  if (loading || completing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative mb-5 overflow-hidden rounded-[1.5rem] border border-mint/25 bg-[radial-gradient(circle_at_10%_0%,rgba(110,231,183,0.18),transparent_20rem),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(13,16,22,0.92))] p-5 shadow-premium"
      >
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 opacity-70"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "linear-gradient(120deg, transparent, rgba(110,231,183,0.08), transparent)",
            backgroundSize: "220% 220%",
          }}
        />

        <div className="relative mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-mint">
              {automatic ? copy.autoLoadingTitle : copy.loadingTitle}
            </div>
            <motion.div
              key={activeMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-2 max-w-2xl text-sm leading-6 text-white/62"
            >
              {automatic && !completing
                ? copy.autoLoadingSubtitle
                : completing
                  ? copy.completingMessage
                  : activeMessage}
            </motion.div>
          </div>
          <div className="relative h-12 w-12 shrink-0">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-mint/20 border-t-mint"
            />
            <div className="absolute inset-2 rounded-full border border-white/10 bg-black/24" />
          </div>
        </div>

        <div className="relative mb-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
            <span>{copy.progressLabel}</span>
            <motion.span key={progress} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {progress}%
            </motion.span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/28">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#6ee7b7,#d7a84f,#6ee7b7)] shadow-[0_0_24px_rgba(110,231,183,0.35)]"
              initial={{ width: "8%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="relative grid gap-2 sm:grid-cols-5">
          {copy.steps.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0.35, y: 8 }}
              animate={{
                opacity: index <= activeStage ? 1 : 0.42,
                y: 0,
                borderColor:
                  index === activeStage
                    ? "rgba(110,231,183,0.45)"
                    : "rgba(255,255,255,0.10)",
              }}
              transition={{
                duration: 0.35,
                delay: index * 0.18,
              }}
              className="rounded-xl border bg-black/18 px-3 py-3 text-xs font-semibold text-white/70"
            >
              <span className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-white/35">
                {String(index + 1).padStart(2, "0")}
              </span>
              {step}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-[1.5rem] border border-mint/25 bg-mint/10 p-4 text-sm text-white shadow-premium"
    >
      <div>
        <span className="font-semibold text-mint">{copy.updated}</span>{" "}
        {copy.cityScanned}: {result?.city}.{" "}
        {copy.found} {result?.scraped_count}, {copy.new} {result?.created_count},{" "}
        {copy.changed} {result?.updated_count}, {copy.duplicate} {result?.duplicate_count},{" "}
        {copy.skipped} {result?.skipped_count}.
      </div>

      {result?.sources?.length ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/38">
            {copy.sourceSummary}
          </div>
          {summaryParts.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {summaryParts.map((summary) => (
                <span
                  key={summary}
                  className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/58"
                >
                  {summary}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2 md:grid-cols-3">
            {successfulSources.map((source) => (
              <div
                key={source.source}
                className="rounded-xl border border-mint/25 bg-black/18 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{source.source}</span>
                  <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-1 text-[10px] font-semibold text-mint">
                    {copy.statuses.success}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-white/52">
                  <span>{copy.found} {source.scraped_count}</span>
                  <span>{copy.new} {source.created_count}</span>
                  <span>{copy.changed} {source.updated_count}</span>
                </div>
              </div>
            ))}
          </div>

          {attentionSources.length ? (
            <details className="mt-4 rounded-xl border border-white/10 bg-black/14 p-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white/74">
                {copy.attentionTitle}
              </summary>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-white/45">
                {copy.attentionExplanation}
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {attentionSources.map((source) => {
                  const status = statusForSource(source);

                  return (
                    <div
                      key={source.source}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-semibold text-white/76">{source.source}</span>
                        <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-semibold text-white/50">
                          {copy.statuses[status]}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-white/42">
                        <span>{copy.found} {source.scraped_count}</span>
                        <span>{copy.new} {source.created_count}</span>
                        <span>{copy.changed} {source.updated_count}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/42">
                        {status === "blocked" || status === "failed"
                          ? copy.blockedMessage
                          : copy.statuses.no_results}
                      </p>
                      {source.manual_search_url ? (
                        <a
                          href={source.manual_search_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/62 transition hover:border-brass/35 hover:text-white"
                        >
                          {copy.manualOpen}
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

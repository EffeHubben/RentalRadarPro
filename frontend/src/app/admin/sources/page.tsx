"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  fetchAdminManagedSources,
  updateAdminManagedSource,
  updateAdminManagedSourceEnabled,
} from "@/lib/admin";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import type {
  AdminManagedSource,
  ManagedSourceStatus,
  ManagedSourceType,
} from "@/types/admin";

const sourceTypes: ManagedSourceType[] = [
  "scraper_active",
  "manual_external",
  "feed",
  "api",
  "partner_import",
  "unsupported",
];

const sourceStatuses: ManagedSourceStatus[] = [
  "active",
  "paused",
  "blocked",
  "needs_review",
  "manual_only",
  "unsupported",
];

const copy: Record<Language, {
  title: string;
  subtitle: string;
  back: string;
  loginTitle: string;
  loginBody: string;
  loginCta: string;
  unauthorizedTitle: string;
  unauthorizedBody: string;
  loading: string;
  refresh: string;
  explanation: string;
  search: string;
  allTypes: string;
  allStatuses: string;
  monitored: string;
  scannable: string;
  manual: string;
  blocked: string;
  name: string;
  baseUrl: string;
  type: string;
  status: string;
  enabled: string;
  interval: string;
  lastChecked: string;
  lastSuccess: string;
  lastError: string;
  actions: string;
  enable: string;
  disable: string;
  saved: string;
  unknown: string;
}> = {
  nl: {
    title: "Bronbeheer",
    subtitle: "Beheer de broncatalogus zonder elke bron als actieve scraper te behandelen.",
    back: "Terug naar admin",
    loginTitle: "Log in met een admin-account",
    loginBody: "Deze pagina is alleen beschikbaar voor beheerders van RentScout.",
    loginCta: "Inloggen",
    unauthorizedTitle: "Niet geautoriseerd",
    unauthorizedBody: "Je account heeft geen admin-rechten.",
    loading: "Bronnen laden...",
    refresh: "Vernieuwen",
    explanation: "Niet elke bron wordt automatisch gescrapet. Actieve scrapers, feeds en APIs kunnen scannen wanneer ze enabled en active zijn. Handmatige, partner-, geblokkeerde en unsupported bronnen blijven in de catalogus voor monitoring en opvolging.",
    search: "Zoek bron of URL",
    allTypes: "Alle types",
    allStatuses: "Alle statussen",
    monitored: "Gemonitord",
    scannable: "Scannable",
    manual: "Handmatig",
    blocked: "Geblokkeerd",
    name: "Naam",
    baseUrl: "URL",
    type: "Type",
    status: "Status",
    enabled: "Enabled",
    interval: "Interval",
    lastChecked: "Laatste check",
    lastSuccess: "Laatste succes",
    lastError: "Laatste fout",
    actions: "Acties",
    enable: "Enable",
    disable: "Disable",
    saved: "Opgeslagen",
    unknown: "Onbekend",
  },
  en: {
    title: "Source Management",
    subtitle: "Manage the source catalog without treating every source as an active scraper.",
    back: "Back to admin",
    loginTitle: "Log in with an admin account",
    loginBody: "This page is available only to RentScout administrators.",
    loginCta: "Log in",
    unauthorizedTitle: "Not authorized",
    unauthorizedBody: "Your account does not have admin access.",
    loading: "Loading sources...",
    refresh: "Refresh",
    explanation: "Not every source is automatically scraped. Active scrapers, feeds and APIs scan only when they are enabled and active. Manual, partner, blocked and unsupported sources stay in the catalog for monitoring and follow-up.",
    search: "Search source or URL",
    allTypes: "All types",
    allStatuses: "All statuses",
    monitored: "Monitored",
    scannable: "Scannable",
    manual: "Manual",
    blocked: "Blocked",
    name: "Name",
    baseUrl: "URL",
    type: "Type",
    status: "Status",
    enabled: "Enabled",
    interval: "Interval",
    lastChecked: "Last checked",
    lastSuccess: "Last success",
    lastError: "Last error",
    actions: "Actions",
    enable: "Enable",
    disable: "Disable",
    saved: "Saved",
    unknown: "Unknown",
  },
};

function formatDate(value: string | null, language: Language, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function badgeTone(status: ManagedSourceStatus | ManagedSourceType | "enabled" | "disabled") {
  if (status === "active" || status === "scraper_active" || status === "api" || status === "feed" || status === "enabled") {
    return "border-mint/30 bg-mint/12 text-mint";
  }
  if (status === "blocked" || status === "paused" || status === "needs_review") {
    return "border-brass/30 bg-brass/12 text-brass";
  }
  if (status === "unsupported" || status === "disabled") {
    return "border-danger/30 bg-danger/12 text-danger";
  }
  return "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]";
}

export default function AdminSourcesPage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const pageCopy = copy[language];
  const [modalOpen, setModalOpen] = useState(false);
  const [sources, setSources] = useState<AdminManagedSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ManagedSourceType | "">("");
  const [statusFilter, setStatusFilter] = useState<ManagedSourceStatus | "">("");
  const isAdmin = Boolean(auth.user?.is_admin);

  const loadSources = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      setSources(await fetchAdminManagedSources(auth.accessToken));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load sources.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, isAdmin]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const filteredSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sources.filter((source) => {
      if (typeFilter && source.source_type !== typeFilter) return false;
      if (statusFilter && source.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return `${source.name} ${source.slug} ${source.base_url}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, sources, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    monitored: sources.filter((source) => source.is_enabled).length,
    scannable: sources.filter((source) => source.is_scannable).length,
    manual: sources.filter((source) => source.source_type === "manual_external" || source.status === "manual_only").length,
    blocked: sources.filter((source) => source.status === "blocked").length,
  }), [sources]);

  const updateSource = useCallback(async (
    source: AdminManagedSource,
    payload: Partial<Pick<AdminManagedSource, "source_type" | "status">>,
  ) => {
    if (!auth.accessToken) return;
    setError("");
    try {
      const updated = await updateAdminManagedSource(auth.accessToken, source.slug, payload);
      setSources((current) => current.map((item) => item.slug === updated.slug ? updated : item));
      setNotice(pageCopy.saved);
      window.setTimeout(() => setNotice(""), 1800);
    } catch (caughtError) {
      setNotice("");
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update source.");
    }
  }, [auth.accessToken, pageCopy.saved]);

  const toggleEnabled = useCallback(async (source: AdminManagedSource) => {
    if (!auth.accessToken) return;
    setError("");
    try {
      const updated = await updateAdminManagedSourceEnabled(auth.accessToken, source.slug, !source.is_enabled);
      setSources((current) => current.map((item) => item.slug === updated.slug ? updated : item));
      setNotice(pageCopy.saved);
      window.setTimeout(() => setNotice(""), 1800);
    } catch (caughtError) {
      setNotice("");
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update source.");
    }
  }, [auth.accessToken, pageCopy.saved]);

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main>
        <section className="border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <Link href="/admin" className="rs-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold">
              {pageCopy.back}
            </Link>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-[var(--color-text)]">
              {pageCopy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--color-muted)]">
              {pageCopy.subtitle}
            </p>
          </div>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6">
              <h2 className="text-2xl font-semibold">{pageCopy.loginTitle}</h2>
              <p className="mt-3 text-sm text-[var(--color-muted)]">{pageCopy.loginBody}</p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rs-primary-button mt-6 h-11 rounded-lg px-5 text-sm font-semibold"
              >
                {pageCopy.loginCta}
              </button>
            </div>
          </section>
        ) : !isAdmin ? (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6">
              <h2 className="text-2xl font-semibold">{pageCopy.unauthorizedTitle}</h2>
              <p className="mt-3 text-sm text-[var(--color-muted)]">{pageCopy.unauthorizedBody}</p>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-6 text-[var(--color-muted)]">
              {pageCopy.explanation}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [pageCopy.monitored, stats.monitored],
                [pageCopy.scannable, stats.scannable],
                [pageCopy.manual, stats.manual],
                [pageCopy.blocked, stats.blocked],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{label}</div>
                  <div className="mt-2 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:flex-row lg:items-center">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={pageCopy.search}
                className="rs-modal-input h-11 min-w-0 flex-1 px-3 text-sm"
              />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as ManagedSourceType | "")}
                className="rs-modal-input h-11 px-3 text-sm"
              >
                <option value="">{pageCopy.allTypes}</option>
                {sourceTypes.map((sourceType) => <option key={sourceType} value={sourceType}>{sourceType}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ManagedSourceStatus | "")}
                className="rs-modal-input h-11 px-3 text-sm"
              >
                <option value="">{pageCopy.allStatuses}</option>
                {sourceStatuses.map((sourceStatus) => <option key={sourceStatus} value={sourceStatus}>{sourceStatus}</option>)}
              </select>
              <button
                type="button"
                onClick={() => void loadSources()}
                disabled={loading}
                className="rs-control h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
              >
                {pageCopy.refresh}
              </button>
            </div>

            {notice ? (
              <div className="mt-4 rounded-xl border border-mint/30 bg-mint/12 px-4 py-3 text-sm font-semibold text-mint">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/12 px-4 py-3 text-sm font-semibold text-danger">
                {error}
              </div>
            ) : null}

            <div className="mt-6 overflow-x-auto rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="min-w-[1120px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-subtle)]">
                    {[pageCopy.name, pageCopy.baseUrl, pageCopy.type, pageCopy.status, pageCopy.enabled, pageCopy.interval, pageCopy.lastChecked, pageCopy.lastSuccess, pageCopy.lastError, pageCopy.actions].map((label) => (
                      <th key={label} className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSources.map((source) => (
                    <tr key={source.slug} className="align-top">
                      <td className="border-b border-[var(--color-border)] px-3 py-3">
                        <div className="font-semibold text-[var(--color-text)]">{source.name}</div>
                        <div className="mt-1 text-xs text-[var(--color-subtle)]">{source.slug}</div>
                        {source.scan_skip_reason ? (
                          <div className="mt-2 text-xs text-[var(--color-subtle)]">{source.scan_skip_reason.replace(/_/g, " ")}</div>
                        ) : null}
                      </td>
                      <td className="max-w-[18rem] border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                        <a href={source.base_url} target="_blank" rel="noopener noreferrer" className="break-all hover:text-[var(--color-text)]">
                          {source.base_url}
                        </a>
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3">
                        <select
                          value={source.source_type}
                          onChange={(event) => void updateSource(source, { source_type: event.target.value as ManagedSourceType })}
                          className="rs-modal-input h-10 px-2 text-xs"
                        >
                          {sourceTypes.map((sourceType) => <option key={sourceType} value={sourceType}>{sourceType}</option>)}
                        </select>
                        <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeTone(source.source_type)}`}>
                          {source.source_type}
                        </div>
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3">
                        <select
                          value={source.status}
                          onChange={(event) => void updateSource(source, { status: event.target.value as ManagedSourceStatus })}
                          className="rs-modal-input h-10 px-2 text-xs"
                        >
                          {sourceStatuses.map((sourceStatus) => <option key={sourceStatus} value={sourceStatus}>{sourceStatus}</option>)}
                        </select>
                        <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeTone(source.status)}`}>
                          {source.status}
                        </div>
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(source.is_enabled ? "enabled" : "disabled")}`}>
                          {source.is_enabled ? "yes" : "no"}
                        </span>
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                        {source.scan_interval_minutes}m
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                        {formatDate(source.last_checked_at, language, pageCopy.unknown)}
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                        {formatDate(source.last_success_at, language, pageCopy.unknown)}
                      </td>
                      <td className="max-w-[18rem] border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                        <span className="line-clamp-2" title={source.last_error ?? undefined}>
                          {source.last_error || pageCopy.unknown}
                        </span>
                      </td>
                      <td className="border-b border-[var(--color-border)] px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(source)}
                          className="rs-control rounded-lg px-3 py-2 text-xs font-semibold"
                        >
                          {source.is_enabled ? pageCopy.disable : pageCopy.enable}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading ? (
                <p className="p-5 text-sm text-[var(--color-muted)]">{pageCopy.loading}</p>
              ) : null}
            </div>
          </section>
        )}
      </main>
      <SiteFooter language={language} />
      <AuthModal
        open={modalOpen}
        initialMode="login"
        language={language}
        onClose={() => setModalOpen(false)}
        onAuthenticated={() => undefined}
      />
    </div>
  );
}

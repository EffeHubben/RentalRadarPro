"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  fetchAdminEmailDeliveries,
  fetchAdminOverview,
  fetchAdminSources,
  fetchAdminUsers,
} from "@/lib/admin";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import type {
  AdminEmailDelivery,
  AdminOverview,
  AdminUser,
} from "@/types/admin";
import type { SourceInfo } from "@/types/listing";

type AuthMode = "login" | "register";

const copy: Record<
  Language,
  {
    title: string;
    subtitle: string;
    dashboardBadge: string;
    loginTitle: string;
    loginBody: string;
    loginCta: string;
    unauthorizedTitle: string;
    unauthorizedBody: string;
    loading: string;
    failedToLoad: string;
    refresh: string;
    openAccount: string;
    signedInAs: string;
    metrics: {
      totalUsers: string;
      freeUsers: string;
      proUsers: string;
      activeSubscriptions: string;
      totalListings: string;
      recentRegistrations: string;
      recentEmails: string;
      subscriptionAttention: string;
    };
    usersTitle: string;
    emailsTitle: string;
    sourcesTitle: string;
    safeReadOnly: string;
    usersEmpty: string;
    emailsEmpty: string;
    emailsUnavailable: string;
    sourcesEmpty: string;
    table: {
      user: string;
      plan: string;
      status: string;
      renewal: string;
      created: string;
      admin: string;
      verified: string;
      emailType: string;
      userId: string;
      providerId: string;
      source: string;
      health: string;
      lastSuccess: string;
      foundLastScan: string;
      addedToday: string;
    };
    yes: string;
    no: string;
    unknown: string;
  }
> = {
  nl: {
    title: "Admin dashboard",
    subtitle: "Compact overzicht van gebruikers, abonnementen, e-mailverkeer en bronstatus.",
    dashboardBadge: "Alleen-lezen",
    loginTitle: "Log in met een admin-account",
    loginBody: "Deze pagina is alleen beschikbaar voor beheerders van RentScout.",
    loginCta: "Inloggen",
    unauthorizedTitle: "Niet geautoriseerd",
    unauthorizedBody: "Je bent ingelogd, maar dit account heeft geen admin-rechten.",
    loading: "Admin-gegevens worden geladen...",
    failedToLoad: "Admin-gegevens konden niet worden geladen.",
    refresh: "Vernieuwen",
    openAccount: "Open account",
    signedInAs: "Ingelogd als",
    metrics: {
      totalUsers: "Totaal gebruikers",
      freeUsers: "Gratis gebruikers",
      proUsers: "Pro-gebruikers",
      activeSubscriptions: "Actieve abonnementen",
      totalListings: "Totaal listings",
      recentRegistrations: "Registraties, laatste 7 dagen",
      recentEmails: "E-mails, laatste 7 dagen",
      subscriptionAttention: "Canceled + past due + inactive",
    },
    usersTitle: "Recente gebruikers",
    emailsTitle: "Recente e-mailleveringen",
    sourcesTitle: "Bronnen en scannerstatus",
    safeReadOnly: "Alle data is alleen-lezen en bevat geen secrets, tokens of hashes.",
    usersEmpty: "Geen gebruikers gevonden.",
    emailsEmpty: "Nog geen e-mailleveringen gelogd.",
    emailsUnavailable: "De tabel voor e-mailleveringen is nog niet beschikbaar.",
    sourcesEmpty: "Geen bronstatus beschikbaar.",
    table: {
      user: "Gebruiker",
      plan: "Plan",
      status: "Status",
      renewal: "Einde / verlenging",
      created: "Aangemaakt",
      admin: "Admin",
      verified: "Bevestigd",
      emailType: "E-mailtype",
      userId: "User ID",
      providerId: "Provider ID",
      source: "Bron",
      health: "Status",
      lastSuccess: "Laatste succes",
      foundLastScan: "Gevonden",
      addedToday: "Vandaag toegevoegd",
    },
    yes: "Ja",
    no: "Nee",
    unknown: "Onbekend",
  },
  en: {
    title: "Admin dashboard",
    subtitle: "Compact visibility into users, subscriptions, email traffic, and source status.",
    dashboardBadge: "Read-only",
    loginTitle: "Log in with an admin account",
    loginBody: "This page is available only to RentScout administrators.",
    loginCta: "Log in",
    unauthorizedTitle: "Not authorized",
    unauthorizedBody: "You are signed in, but this account does not have admin access.",
    loading: "Loading admin data...",
    failedToLoad: "Admin data could not be loaded.",
    refresh: "Refresh",
    openAccount: "Open account",
    signedInAs: "Signed in as",
    metrics: {
      totalUsers: "Total users",
      freeUsers: "Free users",
      proUsers: "Pro users",
      activeSubscriptions: "Active subscriptions",
      totalListings: "Total listings",
      recentRegistrations: "Registrations, last 7 days",
      recentEmails: "Emails, last 7 days",
      subscriptionAttention: "Canceled + past due + inactive",
    },
    usersTitle: "Recent users",
    emailsTitle: "Recent email deliveries",
    sourcesTitle: "Sources and scanner status",
    safeReadOnly: "All data is read-only and excludes secrets, tokens, and hashes.",
    usersEmpty: "No users found.",
    emailsEmpty: "No email deliveries have been logged yet.",
    emailsUnavailable: "The email delivery table is not available yet.",
    sourcesEmpty: "No source status is available.",
    table: {
      user: "User",
      plan: "Plan",
      status: "Status",
      renewal: "End / renewal",
      created: "Created",
      admin: "Admin",
      verified: "Verified",
      emailType: "Email type",
      userId: "User ID",
      providerId: "Provider ID",
      source: "Source",
      health: "Status",
      lastSuccess: "Last success",
      foundLastScan: "Found",
      addedToday: "Added today",
    },
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
  },
};

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function formatDate(value: string | null, language: Language, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rs-card-solid rounded-[1.35rem] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
        {title}
      </div>
      <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const { language, changeLanguage } = useLanguagePreference();
  const pageCopy = copy[language];
  const [modalOpen, setModalOpen] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [deliveries, setDeliveries] = useState<AdminEmailDelivery[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [deliveriesAvailable, setDeliveriesAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = Boolean(auth.user?.is_admin);

  const loadAdminData = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [overviewResponse, usersResponse, deliveriesResponse, sourcesResponse] =
        await Promise.all([
          fetchAdminOverview(auth.accessToken),
          fetchAdminUsers(auth.accessToken, 50),
          fetchAdminEmailDeliveries(auth.accessToken, 50),
          fetchAdminSources(auth.accessToken),
        ]);

      setOverview(overviewResponse);
      setUsers(usersResponse.items);
      setDeliveries(deliveriesResponse.items);
      setDeliveriesAvailable(deliveriesResponse.table_available);
      setSources(sourcesResponse);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, isAdmin, pageCopy.failedToLoad]);

  useEffect(() => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    void loadAdminData();
  }, [auth.accessToken, isAdmin, loadAdminData]);

  const subscriptionAttentionCount = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return (
      overview.canceled_subscriptions +
      overview.past_due_subscriptions +
      overview.inactive_subscriptions
    );
  }, [overview]);

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="animate-warm-drift absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_80%_18%,var(--color-hero-glow),transparent_34rem)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {pageCopy.dashboardBadge}
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.06] text-[var(--color-text)] sm:text-5xl">
              {pageCopy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
              {pageCopy.subtitle}
            </p>
            {auth.isAuthenticated ? (
              <p className="mt-6 text-sm font-medium text-[var(--color-muted)]">
                {pageCopy.signedInAs} {auth.user?.email}
              </p>
            ) : null}
          </div>
        </section>

        {!auth.isAuthenticated ? (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">
                {pageCopy.loginTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                {pageCopy.loginBody}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="rs-primary-button h-11 rounded-lg px-5 text-sm font-semibold"
                >
                  {pageCopy.loginCta}
                </button>
                <Link
                  href="/account"
                  className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {pageCopy.openAccount}
                </Link>
              </div>
            </div>
          </section>
        ) : !isAdmin ? (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="rs-card rounded-[1.5rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">
                {pageCopy.unauthorizedTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
                {pageCopy.unauthorizedBody}
              </p>
              <div className="mt-8">
                <Link
                  href="/account"
                  className="rs-control inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
                >
                  {pageCopy.openAccount}
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            {error ? (
              <div className="mb-6 rounded-[1.25rem] border border-danger/30 bg-[var(--color-danger-soft)] px-5 py-4 text-sm text-[var(--color-text)]">
                {error}
              </div>
            ) : null}

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-muted)]">{pageCopy.safeReadOnly}</p>
              <button
                type="button"
                onClick={() => void loadAdminData()}
                disabled={loading}
                className="rs-control rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? pageCopy.loading : pageCopy.refresh}
              </button>
            </div>

            {loading && !overview ? (
              <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm text-[var(--color-muted)]">
                {pageCopy.loading}
              </div>
            ) : null}

            {overview ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Reveal>
                    <MetricCard title={pageCopy.metrics.totalUsers} value={overview.total_users} />
                  </Reveal>
                  <Reveal delay={0.03}>
                    <MetricCard title={pageCopy.metrics.freeUsers} value={overview.free_users} />
                  </Reveal>
                  <Reveal delay={0.06}>
                    <MetricCard title={pageCopy.metrics.proUsers} value={overview.pro_users} />
                  </Reveal>
                  <Reveal delay={0.09}>
                    <MetricCard
                      title={pageCopy.metrics.activeSubscriptions}
                      value={overview.active_subscriptions}
                    />
                  </Reveal>
                  <Reveal delay={0.12}>
                    <MetricCard title={pageCopy.metrics.totalListings} value={overview.total_listings} />
                  </Reveal>
                  <Reveal delay={0.15}>
                    <MetricCard
                      title={pageCopy.metrics.recentRegistrations}
                      value={overview.recent_registrations_count}
                    />
                  </Reveal>
                  <Reveal delay={0.18}>
                    <MetricCard
                      title={pageCopy.metrics.recentEmails}
                      value={overview.recent_email_deliveries_count}
                    />
                  </Reveal>
                  <Reveal delay={0.21}>
                    <MetricCard
                      title={pageCopy.metrics.subscriptionAttention}
                      value={subscriptionAttentionCount}
                    />
                  </Reveal>
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <Reveal>
                    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-[var(--color-text)]">
                          {pageCopy.usersTitle}
                        </h2>
                        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                          {users.length}
                        </span>
                      </div>
                      {users.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-0 text-sm">
                            <thead>
                              <tr className="text-left text-[var(--color-subtle)]">
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.user}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.plan}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.status}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.renewal}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.created}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.admin}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {users.map((user) => (
                                <tr key={user.id} className="align-top">
                                  <td className="border-b border-[var(--color-border)] px-3 py-3">
                                    <div className="font-semibold text-[var(--color-text)]">{user.email}</div>
                                    <div className="mt-1 text-xs text-[var(--color-muted)]">
                                      {user.display_name || pageCopy.unknown}
                                    </div>
                                    <div className="mt-1 text-xs text-[var(--color-subtle)]">
                                      {pageCopy.table.verified}: {user.email_verified ? pageCopy.yes : pageCopy.no}
                                    </div>
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 capitalize text-[var(--color-muted)]">
                                    {user.plan}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {user.subscription_status}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {formatDate(user.subscription_current_period_end, language, pageCopy.unknown)}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {formatDate(user.created_at, language, pageCopy.unknown)}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {user.is_admin ? pageCopy.yes : pageCopy.no}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-muted)]">{pageCopy.usersEmpty}</p>
                      )}
                    </section>
                  </Reveal>

                  <Reveal delay={0.05}>
                    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-[var(--color-text)]">
                          {pageCopy.emailsTitle}
                        </h2>
                        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                          {deliveries.length}
                        </span>
                      </div>
                      {!deliveriesAvailable ? (
                        <p className="text-sm text-[var(--color-muted)]">{pageCopy.emailsUnavailable}</p>
                      ) : deliveries.length ? (
                        <div className="space-y-3">
                          {deliveries.map((delivery) => (
                            <article
                              key={delivery.id}
                              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="font-semibold text-[var(--color-text)]">{delivery.email_type}</div>
                                <div className="text-xs text-[var(--color-subtle)]">
                                  {formatDate(delivery.created_at, language, pageCopy.unknown)}
                                </div>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] sm:grid-cols-2">
                                <div>{pageCopy.table.userId}: {delivery.user_id ?? pageCopy.unknown}</div>
                                <div>{pageCopy.table.providerId}: {delivery.provider_message_id || pageCopy.unknown}</div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-muted)]">{pageCopy.emailsEmpty}</p>
                      )}
                    </section>
                  </Reveal>
                </div>

                <Reveal delay={0.08}>
                  <section className="mt-6 rs-card rounded-[1.5rem] p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        {pageCopy.sourcesTitle}
                      </h2>
                      <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                        {sources.length}
                      </span>
                    </div>
                    {sources.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-[var(--color-subtle)]">
                              <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.source}</th>
                              <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.health}</th>
                              <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.lastSuccess}</th>
                              <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.foundLastScan}</th>
                              <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.addedToday}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sources.map((source) => (
                              <tr key={source.source_id} className="align-top">
                                <td className="border-b border-[var(--color-border)] px-3 py-3">
                                  <div className="font-semibold text-[var(--color-text)]">{source.display_name}</div>
                                  <div className="mt-1 text-xs text-[var(--color-muted)]">{source.category}</div>
                                </td>
                                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                  {source.status}
                                </td>
                                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                  {formatDate(source.last_success_at, language, pageCopy.unknown)}
                                </td>
                                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                  {source.listings_found_last_scan ?? 0}
                                </td>
                                <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                  {source.listings_added_today ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--color-muted)]">{pageCopy.sourcesEmpty}</p>
                    )}
                  </section>
                </Reveal>
              </>
            ) : null}
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { ToastStack, type Toast } from "@/components/dashboard/ToastStack";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  type AdminCoverageResponse,
  fetchAdminAnalyticsLive,
  fetchAdminAnalyticsOverview,
  fetchAdminCoverage,
  fetchAdminEmailDeliveries,
  fetchAdminHealth,
  fetchAdminOverview,
  fetchAdminSources,
  fetchAdminUsers,
  updateAdminUserAdminStatus,
  updateAdminUserPlan,
  deleteAdminUser,
} from "@/lib/admin";
import type { Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/useLanguagePreference";
import type {
  AdminAnalyticsOverview,
  AdminEmailDelivery,
  AdminEmailDeliveryStatus,
  AdminHealth,
  AdminOverview,
  AdminUser,
  AdminUserSegment,
} from "@/types/admin";
import type { SourceInfo } from "@/types/listing";

type ToastType = Toast["type"];
type UserActionMode = "grant_admin" | "revoke_admin" | "set_free" | "set_pro" | "delete_user";

type UserActionState = {
  mode: UserActionMode;
  user: AdminUser;
};

type PageCopy = {
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
  safetyNotice: string;
  actionHint: string;
  resendTodo: string;
  emailTrackingLimited: string;
  filters: {
    searchUsers: string;
    allUsers: string;
    freeUsers: string;
    proUsers: string;
    adminUsers: string;
    inactiveUsers: string;
    pastDueUsers: string;
    canceledUsers: string;
    allEmailStatuses: string;
    sentEmailStatuses: string;
    failedEmailStatuses: string;
    allEvents: string;
  };
  metrics: {
    totalUsers: string;
    freeUsers: string;
    proUsers: string;
    activeSubscriptions: string;
    totalListings: string;
    recentRegistrations: string;
    recentEmails: string;
    subscriptionAttention: string;
    sources: string;
  };
  usersTitle: string;
  usersSummary: string;
  usersEmpty: string;
  usersActions: {
    makeAdmin: string;
    removeAdmin: string;
    setFree: string;
    setPro: string;
    deleteUser: string;
  };
  emailsTitle: string;
  emailsEmpty: string;
  emailsUnavailable: string;
  sourcesTitle: string;
  sourcesEmpty: string;
  sourcesSummary: string;
  table: {
    userId: string;
    email: string;
    displayName: string;
    plan: string;
    status: string;
    periodEnd: string;
    verified: string;
    admin: string;
    created: string;
    actions: string;
    emailType: string;
    emailStatus: string;
    providerId: string;
    source: string;
    lastScan: string;
    lastSuccess: string;
    lastFailure: string;
    freshness: string;
    listingCount: string;
    activeListings: string;
    lastError: string;
    nextDue: string;
    duration: string;
  };
  modal: {
    title: Record<UserActionMode, string>;
    body: Record<UserActionMode, string>;
    expiryLabel: string;
    expiryHint: string;
    cancel: string;
    confirm: string;
    processing: string;
  };
  statusLabels: {
    online: string;
    degraded: string;
    offline: string;
    limited: string;
    manual: string;
    sent: string;
    recent: string;
    stale: string;
    neverScanned: string;
  };
  yes: string;
  no: string;
  unknown: string;
  today: string;
  analyticsTitle: string;
  analyticsSessions: string;
  analyticsPageViews: string;
  analyticsSearches: string;
  analyticsListingViews: string;
  analyticsOpenClicks: string;
  analyticsLiveSessions: string;
  analyticsLoading: string;
  analyticsEmpty: string;
  healthTitle: string;
  healthDatabase: string;
  healthScanner: string;
  healthConfig: string;
  healthLoading: string;
  analyticsError: string;
  healthError: string;
};

const copy: Record<Language, PageCopy> = {
  nl: {
    title: "Admin dashboard",
    subtitle: "Snelle beheeromgeving voor gebruikers, e-mailleveringen en brongezondheid zonder gevoelige data te tonen.",
    dashboardBadge: "Veilige beheertools",
    loginTitle: "Log in met een admin-account",
    loginBody: "Deze pagina is alleen beschikbaar voor beheerders van RentScout.",
    loginCta: "Inloggen",
    unauthorizedTitle: "Niet geautoriseerd",
    unauthorizedBody: "Je bent ingelogd, maar dit account heeft geen admin-rechten.",
    loading: "Admin-gegevens worden geladen...",
    failedToLoad: "Admin-gegevens kon niet worden geladen.",
    refresh: "Vernieuwen",
    openAccount: "Open account",
    signedInAs: "Ingelogd als",
    safetyNotice: "Secrets, hashes, resettokens en verificatietokens blijven verborgen. Alle mutaties vragen eerst om bevestiging.",
    actionHint: "Plan- en admin-wijzigingen zijn handmatig en annuleren geen externe billing automatisch.",
    resendTodo: "Resend blijft uitgeschakeld: de huidige logging registreert alleen geaccepteerde zendingen en dedupet op event key.",
    emailTrackingLimited: "Status 'failed' is nog niet historisch beschikbaar in deze dataset.",
    filters: {
      searchUsers: "Zoek op e-mail of naam",
      allUsers: "Alle gebruikers",
      freeUsers: "Free",
      proUsers: "Pro",
      adminUsers: "Admins",
      inactiveUsers: "Inactive",
      pastDueUsers: "Past due",
      canceledUsers: "Canceled",
      allEmailStatuses: "Alle statussen",
      sentEmailStatuses: "Sent / delivered",
      failedEmailStatuses: "Failed",
      allEvents: "Alle e-mailtypes",
    },
    metrics: {
      totalUsers: "Totaal gebruikers",
      freeUsers: "Gratis gebruikers",
      proUsers: "Pro-gebruikers",
      activeSubscriptions: "Actieve abonnementen",
      totalListings: "Totaal listings",
      recentRegistrations: "Registraties, laatste 7 dagen",
      recentEmails: "E-mails, laatste 7 dagen",
      subscriptionAttention: "Canceled + past due + inactive",
      sources: "Bronnen (totaal / online)",
    },
    usersTitle: "Gebruikers",
    usersSummary: "Zoeken, filteren en veilige accountwijzigingen uitvoeren zonder destructieve acties.",
    usersEmpty: "Geen gebruikers gevonden voor deze filters.",
    usersActions: {
      makeAdmin: "Maak admin",
      removeAdmin: "Verwijder admin",
      setFree: "Zet op Free",
      setPro: "Zet op Pro",
      deleteUser: "Verwijderen",
    },
    emailsTitle: "E-mailleveringen",
    emailsEmpty: "Geen e-mailleveringen voor deze filters.",
    emailsUnavailable: "De tabel voor e-mailleveringen is nog niet beschikbaar.",
    sourcesTitle: "Bronnen en scannerstatus",
    sourcesEmpty: "Geen bronstatus beschikbaar.",
    sourcesSummary: "Alleen-lezen overzicht van scanstatus, versheid en recente listing-aantallen.",
    table: {
      userId: "User ID",
      email: "E-mail",
      displayName: "Naam",
      plan: "Plan",
      status: "Abonnementsstatus",
      periodEnd: "Periode-einde",
      verified: "Bevestigd",
      admin: "Admin",
      created: "Aangemaakt",
      actions: "Acties",
      emailType: "E-mailtype",
      emailStatus: "Status",
      providerId: "Provider ID",
      source: "Bron",
      lastScan: "Laatste scan",
      lastSuccess: "Laatste succes",
      lastFailure: "Laatste fout",
      freshness: "Versheid",
      listingCount: "Listings",
      activeListings: "Actief",
      lastError: "Laatste foutmelding",
      nextDue: "Volgende scan",
      duration: "Duur",
    },
    modal: {
      title: {
        grant_admin: "Admin-rechten toekennen",
        revoke_admin: "Admin-rechten verwijderen",
        set_free: "Gebruiker naar Free zetten",
        set_pro: "Gebruiker naar Pro zetten",
        delete_user: "Gebruiker verwijderen",
      },
      body: {
        grant_admin: "Deze gebruiker krijgt toegang tot admin-endpoints en het admin-dashboard.",
        revoke_admin: "Deze gebruiker verliest toegang tot admin-endpoints en het admin-dashboard.",
        set_free: "Deze gebruiker wordt handmatig op Free gezet. Dit verwijdert geen externe Stripe-abonnementen.",
        set_pro: "Deze gebruiker wordt handmatig op Pro gezet. Een einddatum is optioneel voor tijdelijke toegang.",
        delete_user: "Weet je zeker dat je deze gebruiker wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.",
      },
      expiryLabel: "Optionele einddatum",
      expiryHint: "Laat leeg voor handmatige Pro zonder verloopdatum.",
      cancel: "Annuleren",
      confirm: "Bevestigen",
      processing: "Bezig...",
    },
    statusLabels: {
      online: "Online",
      degraded: "Vertraagd",
      offline: "Offline",
      limited: "Beperkt",
      manual: "Handmatig",
      sent: "Sent",
      recent: "Recent",
      stale: "Verouderd",
      neverScanned: "Nog niet gescand",
    },
    yes: "Ja",
    no: "Nee",
    unknown: "Onbekend",
    today: "vandaag",
    analyticsTitle: "Analytics",
    analyticsSessions: "Sessies vandaag",
    analyticsPageViews: "Paginaweergaven",
    analyticsSearches: "Zoekopdrachten",
    analyticsListingViews: "Woningweergaven",
    analyticsOpenClicks: "Doorkliks",
    analyticsLiveSessions: "Actieve sessies (5 min)",
    analyticsLoading: "Analytics laden…",
    analyticsEmpty: "Nog geen analytics-data beschikbaar.",
    healthTitle: "Systeemstatus",
    healthDatabase: "Database",
    healthScanner: "Scanner",
    healthConfig: "Configuratie",
    healthLoading: "Status laden…",
    analyticsError: "Analytics konden niet worden geladen.",
    healthError: "Systeemstatus kon niet worden geladen.",
  },
  en: {
    title: "Admin dashboard",
    subtitle: "Fast management workspace for users, email deliveries, and source health without exposing sensitive data.",
    dashboardBadge: "Safe admin tools",
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
    safetyNotice: "Secrets, hashes, reset tokens, and verification tokens stay hidden. Every mutation requires confirmation first.",
    actionHint: "Plan and admin changes are manual overrides and do not automatically cancel external billing.",
    resendTodo: "Resend stays disabled: current logging records only accepted sends and dedupes by event key.",
    emailTrackingLimited: "Historical failed-delivery status is not available in the current dataset yet.",
    filters: {
      searchUsers: "Search by email or name",
      allUsers: "All users",
      freeUsers: "Free",
      proUsers: "Pro",
      adminUsers: "Admins",
      inactiveUsers: "Inactive",
      pastDueUsers: "Past due",
      canceledUsers: "Canceled",
      allEmailStatuses: "All statuses",
      sentEmailStatuses: "Sent / delivered",
      failedEmailStatuses: "Failed",
      allEvents: "All email types",
    },
    metrics: {
      totalUsers: "Total users",
      freeUsers: "Free users",
      proUsers: "Pro users",
      activeSubscriptions: "Active subscriptions",
      totalListings: "Total listings",
      recentRegistrations: "Registrations, last 7 days",
      recentEmails: "Emails, last 7 days",
      subscriptionAttention: "Canceled + past due + inactive",
      sources: "Sources (total / online)",
    },
    usersTitle: "Users",
    usersSummary: "Search, filter, and apply safe account changes without destructive actions.",
    usersEmpty: "No users match these filters.",
    usersActions: {
      makeAdmin: "Make admin",
      removeAdmin: "Remove admin",
      setFree: "Set Free",
      setPro: "Set Pro",
      deleteUser: "Delete",
    },
    emailsTitle: "Email deliveries",
    emailsEmpty: "No email deliveries match these filters.",
    emailsUnavailable: "The email deliveries table is not available yet.",
    sourcesTitle: "Sources and scanner status",
    sourcesEmpty: "No source status is available.",
    sourcesSummary: "Read-only view of scan state, freshness, and recent listing volume.",
    table: {
      userId: "User ID",
      email: "Email",
      displayName: "Display name",
      plan: "Plan",
      status: "Subscription status",
      periodEnd: "Period end",
      verified: "Verified",
      admin: "Admin",
      created: "Created",
      actions: "Actions",
      emailType: "Email type",
      emailStatus: "Status",
      providerId: "Provider ID",
      source: "Source",
      lastScan: "Last scan",
      lastSuccess: "Last success",
      lastFailure: "Last failure",
      freshness: "Freshness",
      listingCount: "Listings",
      activeListings: "Active",
      lastError: "Last error",
      nextDue: "Next due",
      duration: "Duration",
    },
    modal: {
      title: {
        grant_admin: "Grant admin access",
        revoke_admin: "Remove admin access",
        set_free: "Set user to Free",
        set_pro: "Set user to Pro",
        delete_user: "Delete user",
      },
      body: {
        grant_admin: "This user will gain access to admin endpoints and the admin dashboard.",
        revoke_admin: "This user will lose access to admin endpoints and the admin dashboard.",
        set_free: "This user will be manually switched to Free. This does not cancel any external Stripe subscription.",
        set_pro: "This user will be manually switched to Pro. An expiry date is optional for temporary access.",
        delete_user: "Are you sure you want to delete this user? This action cannot be undone.",
      },
      expiryLabel: "Optional expiry date",
      expiryHint: "Leave empty for manual Pro access with no expiry.",
      cancel: "Cancel",
      confirm: "Confirm",
      processing: "Working...",
    },
    statusLabels: {
      online: "Online",
      degraded: "Degraded",
      offline: "Offline",
      limited: "Limited",
      manual: "Manual",
      sent: "Sent",
      recent: "Recent",
      stale: "Stale",
      neverScanned: "Never scanned",
    },
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    today: "today",
    analyticsTitle: "Analytics",
    analyticsSessions: "Sessions today",
    analyticsPageViews: "Page views",
    analyticsSearches: "Searches",
    analyticsListingViews: "Listing views",
    analyticsOpenClicks: "Open clicks",
    analyticsLiveSessions: "Active sessions (5 min)",
    analyticsLoading: "Loading analytics…",
    analyticsEmpty: "No analytics data yet.",
    healthTitle: "System health",
    healthDatabase: "Database",
    healthScanner: "Scanner",
    healthConfig: "Config",
    healthLoading: "Loading health…",
    analyticsError: "Analytics could not be loaded.",
    healthError: "Health status could not be loaded.",
  },
};

const userSegments: AdminUserSegment[] = ["all", "free", "pro", "admin", "inactive", "past_due", "canceled"];
const emailStatuses: AdminEmailDeliveryStatus[] = ["all", "sent", "failed"];

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

function formatDateInput(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
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

function getSourceStatusTone(status: SourceInfo["status"]) {
  switch (status) {
    case "online":
      return "border-mint/30 bg-mint/12 text-mint";
    case "degraded":
      return "border-brass/30 bg-brass/12 text-brass";
    case "limited":
      return "border-brass/30 bg-brass/12 text-brass";
    case "offline":
      return "border-danger/35 bg-danger/12 text-danger";
    default:
      return "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]";
  }
}

function formatDuration(durationMs: number | null | undefined, unknown: string) {
  if (!durationMs || durationMs < 0) {
    return unknown;
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function getSubscriptionTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "border-mint/30 bg-mint/12 text-mint";
  }
  if (status === "past_due" || status === "canceled") {
    return "border-brass/30 bg-brass/12 text-brass";
  }
  if (status === "inactive") {
    return "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]";
  }
  return "border-danger/35 bg-danger/12 text-danger";
}

function getFreshness(source: SourceInfo, copyValue: PageCopy, language: Language) {
  if (!source.last_scan_finished_at) {
    return {
      label: copyValue.statusLabels.neverScanned,
      tone: "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]",
    };
  }

  const lastScan = new Date(source.last_scan_finished_at);
  const diffMs = Date.now() - lastScan.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const formatter = new Intl.RelativeTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { numeric: "auto" });

  const roundedHours = Math.max(1, Math.round(diffHours));
  const roundedDays = Math.max(1, Math.round(diffHours / 24));
  const label =
    diffHours < 24
      ? formatter.format(-roundedHours, "hour")
      : formatter.format(-roundedDays, "day");

  return {
    label,
    tone:
      diffHours <= 24
        ? "border-mint/30 bg-mint/12 text-mint"
        : "border-brass/30 bg-brass/12 text-brass",
  };
}

function getUserSegmentLabel(copyValue: PageCopy, segment: AdminUserSegment) {
  switch (segment) {
    case "free":
      return copyValue.filters.freeUsers;
    case "pro":
      return copyValue.filters.proUsers;
    case "admin":
      return copyValue.filters.adminUsers;
    case "inactive":
      return copyValue.filters.inactiveUsers;
    case "past_due":
      return copyValue.filters.pastDueUsers;
    case "canceled":
      return copyValue.filters.canceledUsers;
    default:
      return copyValue.filters.allUsers;
  }
}

function getEmailStatusLabel(copyValue: PageCopy, value: AdminEmailDeliveryStatus) {
  switch (value) {
    case "sent":
      return copyValue.filters.sentEmailStatuses;
    case "failed":
      return copyValue.filters.failedEmailStatuses;
    default:
      return copyValue.filters.allEmailStatuses;
  }
}

function UserActionModal({
  action,
  copyValue,
  onClose,
  onConfirm,
  pending,
}: {
  action: UserActionState | null;
  copyValue: PageCopy;
  onClose: () => void;
  onConfirm: (payload: { expiresAt: string | null }) => void;
  pending: boolean;
}) {
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    setExpiryDate("");
  }, [action]);

  if (!action) {
    return null;
  }

  const requiresExpiry = action.mode === "set_pro";

  return (
    <div className="rs-modal-backdrop-soft fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <div
        className="rs-modal-panel w-full max-w-lg rounded-[1.75rem] p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-action-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-action-title" className="text-2xl font-semibold text-[var(--color-text)]">
              {copyValue.modal.title[action.mode]}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              {copyValue.modal.body[action.mode]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rs-control h-10 w-10 rounded-xl text-lg leading-none"
            aria-label={copyValue.modal.cancel}
          >
            ×
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)]/70 p-4 text-sm text-[var(--color-text)]">
          <div className="font-semibold">{action.user.email}</div>
          <div className="mt-1 text-[var(--color-muted)]">
            {copyValue.table.userId}: {action.user.id}
            {" · "}
            {copyValue.table.plan}: {action.user.plan}
          </div>
        </div>

        {requiresExpiry ? (
          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              {copyValue.modal.expiryLabel}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className="rs-modal-input h-11 w-full px-3 text-sm"
              min={new Date().toISOString().slice(0, 10)}
            />
            <p className="mt-2 text-xs text-[var(--color-muted)]">{copyValue.modal.expiryHint}</p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rs-control h-11 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copyValue.modal.cancel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ expiresAt: formatDateInput(expiryDate) })}
            disabled={pending}
            className="rs-primary-button h-11 rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copyValue.modal.processing : copyValue.modal.confirm}
          </button>
        </div>
      </div>
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
  const [usersTotal, setUsersTotal] = useState(0);
  const [deliveries, setDeliveries] = useState<AdminEmailDelivery[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [coverage, setCoverage] = useState<AdminCoverageResponse | null>(null);
  const [deliveriesAvailable, setDeliveriesAvailable] = useState(true);
  const [deliveryStatusLimited, setDeliveryStatusLimited] = useState(true);
  const [deliveryTypes, setDeliveryTypes] = useState<string[]>([]);
  const [analyticsOverview, setAnalyticsOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [adminHealth, setAdminHealth] = useState<AdminHealth | null>(null);
  const [liveSessions, setLiveSessions] = useState<number | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [mutatingUser, setMutatingUser] = useState(false);
  const [error, setError] = useState("");
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userSegment, setUserSegment] = useState<AdminUserSegment>("all");
  const [emailStatus, setEmailStatus] = useState<AdminEmailDeliveryStatus>("all");
  const [emailType, setEmailType] = useState("");
  const [actionState, setActionState] = useState<UserActionState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const isAdmin = Boolean(auth.user?.is_admin);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = toastId.current + 1;
    toastId.current = id;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUserSearch(userSearchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [userSearchInput]);

  const loadOverview = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingOverview(true);
    try {
      setOverview(await fetchAdminOverview(auth.accessToken));
    } finally {
      setLoadingOverview(false);
    }
  }, [auth.accessToken, isAdmin]);

  const loadUsers = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await fetchAdminUsers(auth.accessToken, {
        limit: 100,
        search: userSearch,
        segment: userSegment,
      });
      setUsers(response.items);
      setUsersTotal(response.total);
    } finally {
      setLoadingUsers(false);
    }
  }, [auth.accessToken, isAdmin, userSearch, userSegment]);

  const loadEmailDeliveries = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingEmails(true);
    try {
      const response = await fetchAdminEmailDeliveries(auth.accessToken, {
        limit: 100,
        status: emailStatus,
        emailType,
      });
      setDeliveries(response.items);
      setDeliveriesAvailable(response.table_available);
      setDeliveryStatusLimited(response.status_tracking_limited);
      setDeliveryTypes(response.available_email_types);
    } finally {
      setLoadingEmails(false);
    }
  }, [auth.accessToken, emailStatus, emailType, isAdmin]);

  const loadSources = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingSources(true);
    try {
      setSources(await fetchAdminSources(auth.accessToken));
      try {
        setCoverage(await fetchAdminCoverage(auth.accessToken));
      } catch {
        setCoverage(null);
      }
    } finally {
      setLoadingSources(false);
    }
  }, [auth.accessToken, isAdmin]);

  const loadAnalytics = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingAnalytics(true);
    setAnalyticsError(false);
    try {
      const [overview, live] = await Promise.all([
        fetchAdminAnalyticsOverview(auth.accessToken),
        fetchAdminAnalyticsLive(auth.accessToken),
      ]);
      setAnalyticsOverview(overview);
      setLiveSessions(live.active_sessions);
    } catch {
      setAnalyticsError(true);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [auth.accessToken, isAdmin]);

  const loadHealth = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setLoadingHealth(true);
    setHealthError(false);
    try {
      setAdminHealth(await fetchAdminHealth(auth.accessToken));
    } catch {
      setHealthError(true);
    } finally {
      setLoadingHealth(false);
    }
  }, [auth.accessToken, isAdmin]);

  const refreshAll = useCallback(async () => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    setRefreshingAll(true);
    setError("");

    try {
      await Promise.all([loadOverview(), loadUsers(), loadEmailDeliveries(), loadSources(), loadAnalytics(), loadHealth()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    } finally {
      setRefreshingAll(false);
    }
  }, [auth.accessToken, isAdmin, loadAnalytics, loadEmailDeliveries, loadHealth, loadOverview, loadSources, loadUsers, pageCopy.failedToLoad]);

  useEffect(() => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    void loadOverview().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    });
    void loadSources().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    });
    void loadAnalytics().catch(() => {});
    void loadHealth().catch(() => {});
  }, [auth.accessToken, isAdmin, loadAnalytics, loadHealth, loadOverview, loadSources, pageCopy.failedToLoad]);

  useEffect(() => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    void loadUsers().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    });
  }, [auth.accessToken, isAdmin, loadUsers, pageCopy.failedToLoad]);

  useEffect(() => {
    if (!auth.accessToken || !isAdmin) {
      return;
    }

    void loadEmailDeliveries().catch((caughtError) => {
      setError(caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad);
    });
  }, [auth.accessToken, isAdmin, loadEmailDeliveries, pageCopy.failedToLoad]);

  const subscriptionAttentionCount = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return overview.canceled_subscriptions + overview.past_due_subscriptions + overview.inactive_subscriptions;
  }, [overview]);

  const currentUserId = auth.user?.id ?? null;

  const handleUserActionConfirm = useCallback(async ({ expiresAt }: { expiresAt: string | null }) => {
    if (!auth.accessToken || !actionState) {
      return;
    }

    setMutatingUser(true);
    setError("");

    try {
      if (actionState.mode === "grant_admin") {
        await updateAdminUserAdminStatus(auth.accessToken, actionState.user.id, true);
      } else if (actionState.mode === "revoke_admin") {
        await updateAdminUserAdminStatus(auth.accessToken, actionState.user.id, false);
      } else if (actionState.mode === "delete_user") {
        await deleteAdminUser(auth.accessToken, actionState.user.id);
      } else if (actionState.mode === "set_free") {
        await updateAdminUserPlan(auth.accessToken, actionState.user.id, {
          plan: "free",
        });
      } else {
        await updateAdminUserPlan(auth.accessToken, actionState.user.id, {
          plan: "pro",
          expires_at: expiresAt,
        });
      }

      setActionState(null);
      await Promise.all([loadUsers(), loadOverview()]);
      showToast(`${actionState.user.email} updated.`, "success");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : pageCopy.failedToLoad;
      setError(message);
      showToast(message, "error");
    } finally {
      setMutatingUser(false);
    }
  }, [actionState, auth.accessToken, loadOverview, loadUsers, pageCopy.failedToLoad, showToast]);

  const userCards = users.map((user) => (
    <article key={user.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 xl:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-[var(--color-text)]">{user.email}</div>
          <div className="mt-1 text-sm text-[var(--color-muted)]">{user.display_name || pageCopy.unknown}</div>
          <div className="mt-2 text-xs text-[var(--color-subtle)]">
            {pageCopy.table.userId}: {user.id}
          </div>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSubscriptionTone(user.subscription_status)}`}>
          {user.subscription_status}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--color-muted)]">
        <div>
          <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.plan}</div>
          <div className="mt-1 text-sm text-[var(--color-text)]">{user.plan}</div>
        </div>
        <div>
          <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.periodEnd}</div>
          <div className="mt-1 text-sm text-[var(--color-text)]">
            {formatDate(user.subscription_current_period_end, language, pageCopy.unknown)}
          </div>
        </div>
        <div>
          <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.verified}</div>
          <div className="mt-1 text-sm text-[var(--color-text)]">{user.email_verified ? pageCopy.yes : pageCopy.no}</div>
        </div>
        <div>
          <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.admin}</div>
          <div className="mt-1 text-sm text-[var(--color-text)]">{user.is_admin ? pageCopy.yes : pageCopy.no}</div>
        </div>
        <div className="col-span-2">
          <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.created}</div>
          <div className="mt-1 text-sm text-[var(--color-text)]">{formatDate(user.created_at, language, pageCopy.unknown)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActionState({ mode: user.is_admin ? "revoke_admin" : "grant_admin", user })}
          disabled={mutatingUser || (user.id === currentUserId && user.is_admin)}
          className="rs-control rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {user.is_admin ? pageCopy.usersActions.removeAdmin : pageCopy.usersActions.makeAdmin}
        </button>
        <button
          type="button"
          onClick={() => setActionState({ mode: "set_free", user })}
          disabled={mutatingUser}
          className="rs-control rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pageCopy.usersActions.setFree}
        </button>
        <button
          type="button"
          onClick={() => setActionState({ mode: "set_pro", user })}
          disabled={mutatingUser}
          className="rs-primary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pageCopy.usersActions.setPro}
        </button>
        <button
          type="button"
          onClick={() => setActionState({ mode: "delete_user", user })}
          disabled={mutatingUser || user.id === currentUserId}
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {pageCopy.usersActions.deleteUser}
        </button>
      </div>
    </article>
  ));

  return (
    <div className="min-h-screen bg-[var(--color-page)] text-[var(--color-text)]">
      <ToastStack toasts={toasts} />
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
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">{pageCopy.loginTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{pageCopy.loginBody}</p>
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
              <h2 className="text-2xl font-semibold text-[var(--color-text)]">{pageCopy.unauthorizedTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{pageCopy.unauthorizedBody}</p>
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

            <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm text-[var(--color-muted)]">
                <div>{pageCopy.safetyNotice}</div>
                <div className="mt-2">{pageCopy.actionHint}</div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                <div className="text-sm text-[var(--color-muted)]">
                  {refreshingAll || loadingOverview || loadingUsers || loadingEmails || loadingSources
                    ? pageCopy.loading
                    : pageCopy.refresh}
                </div>
                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  disabled={refreshingAll}
                  className="rs-control rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pageCopy.refresh}
                </button>
              </div>
            </div>

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
                    <MetricCard title={pageCopy.metrics.activeSubscriptions} value={overview.active_subscriptions} />
                  </Reveal>
                  <Reveal delay={0.12}>
                    <MetricCard title={pageCopy.metrics.totalListings} value={overview.total_listings} />
                  </Reveal>
                  <Reveal delay={0.15}>
                    <MetricCard title={pageCopy.metrics.recentRegistrations} value={overview.recent_registrations_count} />
                  </Reveal>
                  <Reveal delay={0.18}>
                    <MetricCard title={pageCopy.metrics.recentEmails} value={overview.recent_email_deliveries_count} />
                  </Reveal>
                  <Reveal delay={0.21}>
                    <MetricCard title={pageCopy.metrics.subscriptionAttention} value={subscriptionAttentionCount} />
                  </Reveal>
                  <Reveal delay={0.24}>
                    <div className="rs-card-solid rounded-[1.35rem] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                        {pageCopy.metrics.sources}
                      </div>
                      <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">
                        {overview.total_sources}{" "}
                        <span className="text-xl font-normal text-mint">
                          / {overview.online_sources}
                        </span>
                      </div>
                    </div>
                  </Reveal>
                </div>

                {/* Analytics + Health – shown immediately after main stats */}
                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                  <Reveal delay={0.04}>
                    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{pageCopy.analyticsTitle}</h2>
                      {analyticsError ? (
                        <div className="rounded-xl border border-brass/30 bg-brass/12 px-4 py-3 text-sm text-brass">
                          {pageCopy.analyticsError}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {[
                              { label: pageCopy.analyticsLiveSessions, value: liveSessions ?? 0 },
                              { label: pageCopy.analyticsSessions, value: analyticsOverview?.today.unique_sessions ?? 0 },
                              { label: pageCopy.analyticsPageViews, value: analyticsOverview?.today.page_views ?? 0 },
                              { label: pageCopy.analyticsSearches, value: analyticsOverview?.today.searches ?? 0 },
                              { label: pageCopy.analyticsListingViews, value: analyticsOverview?.today.listing_views ?? 0 },
                              { label: pageCopy.analyticsOpenClicks, value: analyticsOverview?.today.open_clicks ?? 0 },
                            ].map(({ label, value }) => (
                              <div key={label} className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-opacity ${loadingAnalytics ? "opacity-40" : ""}`}>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{label}</div>
                                <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">{value}</div>
                              </div>
                            ))}
                          </div>
                          {analyticsOverview && analyticsOverview.trend_7d.length > 0 && (
                            <div className="mt-4">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">7-day trend</div>
                              <div className="flex items-end gap-1" style={{ height: 48 }}>
                                {(() => {
                                  const max = Math.max(...analyticsOverview.trend_7d.map((d) => d.count), 1);
                                  return analyticsOverview.trend_7d.map((day) => (
                                    <div
                                      key={day.date}
                                      title={`${day.date}: ${day.count}`}
                                      className="flex-1 rounded-sm bg-[var(--color-accent)]"
                                      style={{ height: `${Math.max(4, Math.round((day.count / max) * 48))}px`, opacity: 0.7 }}
                                    />
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  </Reveal>

                  <Reveal delay={0.08}>
                    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{pageCopy.healthTitle}</h2>
                      {healthError ? (
                        <div className="rounded-xl border border-brass/30 bg-brass/12 px-4 py-3 text-sm text-brass">
                          {pageCopy.healthError}
                        </div>
                      ) : loadingHealth && !adminHealth ? (
                        <p className="text-sm text-[var(--color-muted)]">{pageCopy.healthLoading}</p>
                      ) : adminHealth ? (
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{pageCopy.healthDatabase}</div>
                              <div className={`mt-1 text-sm font-semibold ${adminHealth.database.status === "ok" ? "text-mint" : "text-danger"}`}>
                                {adminHealth.database.status}
                                {adminHealth.database.latency_ms != null && (
                                  <span className="ml-1 font-normal text-[var(--color-subtle)]">{adminHealth.database.latency_ms}ms</span>
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{pageCopy.healthScanner}</div>
                              <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                {adminHealth.scanner.status === "never_run" ? "never run" : adminHealth.scanner.status}
                              </div>
                              {adminHealth.scanner.age_minutes != null && (
                                <div className="text-xs text-[var(--color-subtle)]">{adminHealth.scanner.age_minutes}m ago</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{pageCopy.healthConfig}</div>
                            <div className="space-y-1">
                              {Object.entries(adminHealth.config).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                  <span className={val ? "text-mint" : "text-[var(--color-subtle)]"}>{val ? "✓" : "·"}</span>
                                  <span className="text-[var(--color-muted)]">{key.replace(/_/g, " ")}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </Reveal>
                </div>

                <div className="mt-8 grid gap-6">
                  <Reveal>
                    <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-[var(--color-text)]">{pageCopy.usersTitle}</h2>
                          <p className="mt-1 text-sm text-[var(--color-muted)]">{pageCopy.usersSummary}</p>
                        </div>
                        <div className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                          {usersTotal}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          type="search"
                          value={userSearchInput}
                          onChange={(event) => setUserSearchInput(event.target.value)}
                          placeholder={pageCopy.filters.searchUsers}
                          className="rs-modal-input h-11 w-full px-3 text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          {userSegments.map((segment) => (
                            <button
                              key={segment}
                              type="button"
                              onClick={() => setUserSegment(segment)}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                userSegment === segment
                                  ? "border-[var(--color-accent)] bg-[var(--color-soft)] text-[var(--color-text)]"
                                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                              }`}
                            >
                              {getUserSegmentLabel(pageCopy, segment)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">{userCards}</div>

                      {users.length ? (
                        <div className="mt-5 hidden overflow-x-auto xl:block">
                          <table className="min-w-full border-separate border-spacing-0 text-sm">
                            <thead>
                              <tr className="text-left text-[var(--color-subtle)]">
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.userId}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.email}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.displayName}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.plan}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.status}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.periodEnd}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.verified}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.admin}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.created}</th>
                                <th className="border-b border-[var(--color-border)] px-3 py-3 font-semibold">{pageCopy.table.actions}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {users.map((user) => (
                                <tr key={user.id} className="align-top">
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">{user.id}</td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 font-semibold text-[var(--color-text)]">{user.email}</td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">{user.display_name || pageCopy.unknown}</td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 capitalize text-[var(--color-muted)]">{user.plan}</td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3">
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSubscriptionTone(user.subscription_status)}`}>
                                      {user.subscription_status}
                                    </span>
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {formatDate(user.subscription_current_period_end, language, pageCopy.unknown)}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {user.email_verified ? pageCopy.yes : pageCopy.no}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {user.is_admin ? pageCopy.yes : pageCopy.no}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                                    {formatDate(user.created_at, language, pageCopy.unknown)}
                                  </td>
                                  <td className="border-b border-[var(--color-border)] px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setActionState({ mode: user.is_admin ? "revoke_admin" : "grant_admin", user })}
                                        disabled={mutatingUser || (user.id === currentUserId && user.is_admin)}
                                        className="rs-control rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {user.is_admin ? pageCopy.usersActions.removeAdmin : pageCopy.usersActions.makeAdmin}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActionState({ mode: "set_free", user })}
                                        disabled={mutatingUser}
                                        className="rs-control rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {pageCopy.usersActions.setFree}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActionState({ mode: "set_pro", user })}
                                        disabled={mutatingUser}
                                        className="rs-primary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {pageCopy.usersActions.setPro}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActionState({ mode: "delete_user", user })}
                                        disabled={mutatingUser || user.id === currentUserId}
                                        className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                                      >
                                        {pageCopy.usersActions.deleteUser}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : loadingUsers ? (
                        <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.loading}</p>
                      ) : (
                        <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.usersEmpty}</p>
                      )}
                    </section>
                  </Reveal>

                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Reveal delay={0.04}>
                      <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)]">{pageCopy.emailsTitle}</h2>
                            <p className="mt-1 text-sm text-[var(--color-muted)]">{pageCopy.resendTodo}</p>
                          </div>
                          <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                            {deliveries.length}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          <label className="text-sm">
                            <span className="mb-2 block font-semibold text-[var(--color-text)]">{pageCopy.table.emailStatus}</span>
                            <select
                              value={emailStatus}
                              onChange={(event) => setEmailStatus(event.target.value as AdminEmailDeliveryStatus)}
                              className="rs-modal-input h-11 w-full px-3 text-sm"
                            >
                              {emailStatuses.map((statusValue) => (
                                <option key={statusValue} value={statusValue}>
                                  {getEmailStatusLabel(pageCopy, statusValue)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            <span className="mb-2 block font-semibold text-[var(--color-text)]">{pageCopy.table.emailType}</span>
                            <select
                              value={emailType}
                              onChange={(event) => setEmailType(event.target.value)}
                              className="rs-modal-input h-11 w-full px-3 text-sm"
                            >
                              <option value="">{pageCopy.filters.allEvents}</option>
                              {deliveryTypes.map((deliveryType) => (
                                <option key={deliveryType} value={deliveryType}>
                                  {deliveryType}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {deliveryStatusLimited ? (
                          <div className="mt-4 rounded-xl border border-brass/30 bg-brass/12 px-4 py-3 text-sm text-brass">
                            {pageCopy.emailTrackingLimited}
                          </div>
                        ) : null}

                        {!deliveriesAvailable ? (
                          <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.emailsUnavailable}</p>
                        ) : deliveries.length ? (
                          <div className="mt-5 space-y-3">
                            {deliveries.map((delivery) => (
                              <article
                                key={delivery.id}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-[var(--color-text)]">{delivery.email_type}</div>
                                    <div className="mt-1 text-xs text-[var(--color-subtle)]">
                                      {pageCopy.table.userId}: {delivery.user_id ?? pageCopy.unknown}
                                    </div>
                                  </div>
                                  <div className="rounded-full border border-mint/30 bg-mint/12 px-2.5 py-1 text-xs font-semibold text-mint">
                                    {pageCopy.statusLabels.sent}
                                  </div>
                                </div>
                                <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)] sm:grid-cols-2">
                                  <div>{formatDate(delivery.created_at, language, pageCopy.unknown)}</div>
                                  <div>{pageCopy.table.providerId}: {delivery.provider_message_id || pageCopy.unknown}</div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : loadingEmails ? (
                          <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.loading}</p>
                        ) : (
                          <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.emailsEmpty}</p>
                        )}
                      </section>
                    </Reveal>

                    <Reveal delay={0.08}>
                      <section className="rs-card rounded-[1.5rem] p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)]">{pageCopy.sourcesTitle}</h2>
                            <p className="mt-1 text-sm text-[var(--color-muted)]">{pageCopy.sourcesSummary}</p>
                          </div>
                          <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                            {sources.length}
                          </span>
                        </div>

                        {coverage ? (
                          <div className="mt-5 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                                Listings by city
                              </div>
                              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm text-[var(--color-muted)]">
                                {coverage.listings_by_city.length ? (
                                  coverage.listings_by_city.map((entry) => (
                                    <li key={entry.city} className="flex items-center justify-between gap-3">
                                      <span className="truncate text-[var(--color-text)]">{entry.city}</span>
                                      <span className="font-semibold">{entry.count}</span>
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-[var(--color-subtle)]">No listings yet.</li>
                                )}
                              </ul>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                                Listings by source
                              </div>
                              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-sm text-[var(--color-muted)]">
                                {coverage.listings_by_source.length ? (
                                  coverage.listings_by_source.map((entry) => (
                                    <li key={entry.source} className="flex items-center justify-between gap-3">
                                      <span className="truncate text-[var(--color-text)]">{entry.source}</span>
                                      <span className="font-semibold">{entry.count}</span>
                                    </li>
                                  ))
                                ) : (
                                  <li className="text-[var(--color-subtle)]">No listings yet.</li>
                                )}
                              </ul>
                            </div>
                            {coverage.failed_source_city_combos.length ? (
                              <div className="rounded-2xl border border-danger/30 bg-[var(--color-danger-soft)] p-4 lg:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">
                                  Recent failed source/city combos
                                </div>
                                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--color-muted)]">
                                  {coverage.failed_source_city_combos.map((entry) => (
                                    <li
                                      key={`${entry.source_id}|${entry.city}|${entry.status}`}
                                      className="flex items-center justify-between gap-3"
                                    >
                                      <span className="truncate text-[var(--color-text)]">
                                        {entry.source_id} · {entry.city}
                                      </span>
                                      <span className="font-semibold">
                                        {entry.status} ×{entry.count}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {sources.length ? (
                          <div className="mt-5 mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(() => {
                              const counts = {
                                online: sources.filter((source) => source.status === "online").length,
                                degraded: sources.filter((source) => source.status === "degraded").length,
                                limited: sources.filter((source) => source.status === "limited").length,
                                manual: sources.filter((source) => source.status === "manual").length,
                                auto: sources.filter((source) => source.auto_scan_enabled).length,
                                externalOnly: sources.filter((source) => !source.auto_scan_enabled).length,
                                coolingDown: sources.filter((source) => source.is_cooling_down).length,
                                totalListings: sources.reduce((total, source) => total + (source.total_listing_count ?? 0), 0),
                                addedToday: sources.reduce((total, source) => total + (source.listings_added_today ?? 0), 0),
                                anyError: sources.filter((source) => source.last_error || source.last_failed_error).length,
                              };
                              const cards: Array<{ label: string; value: number; tone: string }> = [
                                { label: pageCopy.statusLabels.online, value: counts.online, tone: "border-mint/30 bg-mint/12 text-mint" },
                                { label: pageCopy.statusLabels.degraded, value: counts.degraded, tone: "border-brass/30 bg-brass/12 text-brass" },
                                { label: pageCopy.statusLabels.limited, value: counts.limited, tone: "border-brass/30 bg-brass/12 text-brass" },
                                { label: pageCopy.statusLabels.manual, value: counts.manual, tone: "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]" },
                                { label: `Auto-scan`, value: counts.auto, tone: "border-mint/30 bg-mint/12 text-mint" },
                                { label: `External only`, value: counts.externalOnly, tone: "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]" },
                                { label: `Cooling down`, value: counts.coolingDown, tone: counts.coolingDown > 0 ? "border-brass/30 bg-brass/12 text-brass" : "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]" },
                                { label: `Total listings`, value: counts.totalListings, tone: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" },
                                { label: `Added today`, value: counts.addedToday, tone: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" },
                                { label: `With recent error`, value: counts.anyError, tone: counts.anyError > 0 ? "border-danger/30 bg-danger/12 text-danger" : "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]" },
                              ];
                              return cards.map((card) => (
                                <div key={card.label} className={`rounded-xl border px-3 py-2.5 ${card.tone}`}>
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">{card.label}</div>
                                  <div className="mt-1 text-xl font-semibold">{card.value}</div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : null}

                        {sources.length ? (
                          <div className="mt-5 space-y-3">
                            {sources.map((source) => {
                              const freshness = getFreshness(source, pageCopy, language);
                              return (
                                <article
                                  key={source.source_id}
                                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="font-semibold text-[var(--color-text)]">{source.display_name}</div>
                                      <div className="mt-1 text-xs text-[var(--color-subtle)]">{source.category}</div>
                                    </div>
                                    <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getSourceStatusTone(source.status)}`}>
                                      {pageCopy.statusLabels[source.status]}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                      source.auto_scan_enabled
                                        ? "border-mint/30 bg-mint/12 text-mint"
                                        : "border-[var(--color-border)] bg-[var(--color-soft)] text-[var(--color-muted)]"
                                    }`}>
                                      {source.auto_scan_enabled ? "Auto-scanned" : "External only"}
                                    </span>
                                    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
                                      {source.source_type ?? "manual"}
                                    </span>
                                    {source.requires_login ? (
                                      <span className="rounded-full border border-brass/30 bg-brass/12 px-2.5 py-1 text-xs font-semibold text-brass">
                                        Login may be required
                                      </span>
                                    ) : null}
                                    {source.is_cooling_down ? (
                                      <span className="rounded-full border border-brass/30 bg-brass/12 px-2.5 py-1 text-xs font-semibold text-brass">
                                        Cooling down
                                      </span>
                                    ) : null}
                                  </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                                <div>
                                  <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.lastScan}</div>
                                  <div className="mt-1 text-[var(--color-text)]">
                                    {formatDate(source.last_scan_finished_at, language, pageCopy.unknown)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.freshness}</div>
                                      <div className="mt-1">
                                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${freshness.tone}`}>
                                          {freshness.label}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                    <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.listingCount}</div>
                                    <div className="mt-1 text-[var(--color-text)]">
                                        {source.total_listing_count ?? source.listings_found_last_scan ?? 0}
                                        <span className="ml-2 text-xs text-[var(--color-muted)]">
                                          +{source.listings_added_today ?? 0} {pageCopy.today}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.lastSuccess}</div>
                                      <div className="mt-1 text-[var(--color-text)]">
                                        {formatDate(source.last_success_at, language, pageCopy.unknown)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.lastFailure}</div>
                                      <div className="mt-1 text-[var(--color-text)]">
                                        {formatDate(source.last_failed_at ?? null, language, pageCopy.unknown)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.activeListings}</div>
                                      <div className="mt-1 text-[var(--color-text)]">
                                        {source.active_listing_count ?? 0}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.nextDue}</div>
                                      <div className="mt-1 text-[var(--color-text)]">
                                        {formatDate(source.next_due_at ?? null, language, pageCopy.unknown)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.duration}</div>
                                      <div className="mt-1 text-[var(--color-text)]">
                                        {formatDuration(source.last_run?.duration_ms, pageCopy.unknown)}
                                      </div>
                                    </div>
                                  </div>

                                  {source.last_failed_error || source.last_error ? (
                                    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-muted)]">
                                      <span className="font-semibold text-[var(--color-subtle)]">{pageCopy.table.lastError}:</span>{" "}
                                      {source.last_failed_error || source.last_error}
                                    </div>
                                  ) : null}
                                  {source.scan_skip_reason ? (
                                    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-muted)]">
                                      <span className="font-semibold text-[var(--color-subtle)]">Scanner:</span>{" "}
                                      {source.scan_skip_reason.replace(/_/g, " ")}
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        ) : loadingSources ? (
                          <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.loading}</p>
                        ) : (
                          <p className="mt-5 text-sm text-[var(--color-muted)]">{pageCopy.sourcesEmpty}</p>
                        )}
                      </section>
                    </Reveal>
                  </div>

                </div>
              </>
            ) : (
              <div className="rounded-[1.25rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm text-[var(--color-muted)]">
                {pageCopy.loading}
              </div>
            )}
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

      <UserActionModal
        action={actionState}
        copyValue={pageCopy}
        onClose={() => setActionState(null)}
        onConfirm={(payload) => void handleUserActionConfirm(payload)}
        pending={mutatingUser}
      />
    </div>
  );
}

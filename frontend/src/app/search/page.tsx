"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPro } from "@/lib/subscription";
import { ActiveFilters } from "@/components/dashboard/ActiveFilters";
import { ExternalSourcesPanel } from "@/components/dashboard/ExternalSourcesPanel";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { ListingCard } from "@/components/dashboard/ListingCard";
import { ListingModal } from "@/components/dashboard/ListingModal";
import { EmptyState, SkeletonGrid } from "@/components/dashboard/States";
import { Toast, ToastStack } from "@/components/dashboard/ToastStack";
import { WelcomeScreen } from "@/components/dashboard/WelcomeScreen";
import { SiteHeader } from "@/components/site/SiteHeader";
import { createInitialFilters, formatPrice } from "@/components/dashboard/helpers";
import {
  buildListingQueryParams,
  fetchListings,
  fetchScraperFreshness,
  fetchSources,
} from "@/lib/api";
import { i18n, type Language } from "@/lib/i18n";
import {
  listingWorkflowKey,
  loadListingWorkflowState,
  saveListingWorkflowState,
  workflowNoteForListing,
  workflowStatusForListing,
} from "@/lib/listingWorkflow";
import {
  createProfileId,
  listingFiltersFromProfile,
  loadSearchProfiles,
  profileFiltersEqual,
  profileFiltersFromListingFilters,
  saveSearchProfiles,
} from "@/lib/searchProfiles";
import type {
  Listing,
  ListingFilters,
  ListingSort,
  ListingStatus,
  ListingsPage,
  LocalListingWorkflowState,
  PropertyType,
  ScraperFreshness,
  SearchProfile,
  SourceInfo,
} from "@/types/listing";

const onboardingStorageKey = "rental-radar-onboarding-complete-v1";

function PreviewBanner({
  visibleCount,
  totalCount,
  isGuest,
  banner,
}: {
  visibleCount: number;
  totalCount: number;
  isGuest: boolean;
  banner: {
    title: string;
    body: string;
    proUnlocks: string;
    ctaGuest: string;
    ctaFree: string;
    visibleCountOf: string;
    visibleCountSuffix: string;
  };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="mt-6 rounded-[1.5rem] border border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">{banner.title}</div>
          <p className="rs-muted mt-1 text-sm leading-6">{banner.body}</p>
          <p className="rs-subtle mt-1 text-xs">{banner.proUnlocks}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--color-teal)]">
            {visibleCount} {banner.visibleCountOf} {totalCount} {banner.visibleCountSuffix}
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href={isGuest ? "/account" : "/#pricing"}
            className="inline-block rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {isGuest ? banner.ctaGuest : banner.ctaFree}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function PreviewLockedDialog({
  isGuest,
  language,
  onClose,
}: {
  isGuest: boolean;
  language: Language;
  onClose: () => void;
}) {
  const copy = i18n[language].listing;

  return (
    <motion.div
      className="rs-modal-backdrop-soft fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="rs-modal-panel w-full max-w-md rounded-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-locked-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="preview-locked-title" className="text-lg font-semibold text-[var(--color-text)]">
              {copy.lockedPreview}
            </h2>
            <p className="rs-muted mt-2 text-sm leading-6">{copy.lockedDetails}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rs-control h-10 w-10 shrink-0 rounded-xl text-sm font-semibold"
            aria-label={i18n[language].modal.close}
          >
            x
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rs-control rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            {i18n[language].modal.close}
          </button>
          <Link
            href={isGuest ? "/account" : "/#pricing"}
            className="rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-center text-sm font-semibold text-[white] transition hover:opacity-90"
            onClick={onClose}
          >
            {isGuest ? copy.lockedCtaGuest : copy.lockedCtaFree}
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickEditPanel({
  filters,
  language,
  onClose,
  onUpdate,
}: {
  filters: ListingFilters;
  language: Language;
  onClose: () => void;
  onUpdate: (next: Partial<ListingFilters>) => void;
}) {
  const copy = i18n[language];
  const onbCopy = copy.onboarding;
  const propertyCopy = copy.propertyTypes;
  const propertyOptions: Array<PropertyType | ""> = ["", "studio", "apartment", "room", "house"];

  function toggleType(type: PropertyType | "") {
    if (!type) {
      onUpdate({ propertyTypes: [], offset: 0 });
      return;
    }
    const next = filters.propertyTypes.includes(type)
      ? filters.propertyTypes.filter((t) => t !== type)
      : [...filters.propertyTypes, type];
    onUpdate({ propertyTypes: next, offset: 0 });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="dashboard-shell mb-5 rounded-2xl p-5"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {copy.dashboard.quickEditTitle}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rs-control h-9 rounded-xl px-4 text-sm font-semibold"
        >
          {copy.dashboard.quickEditClose}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rs-subtle mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em]">
            {onbCopy.city}
          </label>
          <input
            value={filters.city}
            onChange={(e) => onUpdate({ city: e.target.value, offset: 0 })}
            className="rs-input h-10 w-full"
            placeholder={onbCopy.cityPlaceholder}
          />
        </div>

        <div>
          <label className="rs-subtle mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em]">
            {onbCopy.budget}
          </label>
          <input
            type="number"
            min="0"
            disabled={filters.noMaxPrice}
            value={filters.maxPrice}
            onChange={(e) => onUpdate({ maxPrice: e.target.value, offset: 0 })}
            className="rs-input h-10 w-full disabled:cursor-not-allowed disabled:opacity-40"
            placeholder={onbCopy.maxRent}
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={filters.noMaxPrice}
              onChange={(e) =>
                onUpdate({
                  noMaxPrice: e.target.checked,
                  maxPrice: e.target.checked ? "" : filters.maxPrice,
                  offset: 0,
                })
              }
              className="h-4 w-4"
            />
            {onbCopy.noMaxPrice}
          </label>
        </div>

        <div className="sm:col-span-2">
          <div className="rs-subtle mb-2 text-xs font-semibold uppercase tracking-[0.12em]">
            {onbCopy.propertyType}
          </div>
          <div className="flex flex-wrap gap-2">
            {propertyOptions.map((type) => {
              const active = type
                ? filters.propertyTypes.includes(type)
                : filters.propertyTypes.length === 0;
              return (
                <button
                  key={type || "all"}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "rs-chip-active"
                      : "rs-chip hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {type ? propertyCopy[type] : onbCopy.allTypes}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="rs-subtle mb-2 text-xs font-semibold uppercase tracking-[0.12em]">
            {onbCopy.privacy}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ allowShared: !filters.allowShared, offset: 0 })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                !filters.allowShared
                  ? "rs-chip-active"
                  : "rs-chip hover:border-[var(--color-border-strong)]"
              }`}
            >
              {onbCopy.sharedExcluded}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  privateBathroom: filters.privateBathroom === true ? null : true,
                  offset: 0,
                })
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filters.privateBathroom === true
                  ? "rs-chip-active"
                  : "rs-chip hover:border-[var(--color-border-strong)]"
              }`}
            >
              {onbCopy.privateBathroom}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  privateKitchen: filters.privateKitchen === true ? null : true,
                  offset: 0,
                })
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filters.privateKitchen === true
                  ? "rs-chip-active"
                  : "rs-chip hover:border-[var(--color-border-strong)]"
              }`}
            >
              {onbCopy.privateKitchen}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AnimatedValue({ value }: { value: string | number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {value}
    </motion.span>
  );
}

function ErrorPanel({
  message,
  help,
}: {
  message: string;
  help: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-[1.5rem] border border-danger/30 bg-[var(--color-danger-soft)] p-4 text-sm shadow-[var(--shadow-soft)] sm:p-5"
      role="status"
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-danger/30 bg-danger/12 text-base font-semibold text-danger shadow-[0_0_38px_rgba(248,113,113,0.16)]">
          !
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-text)]">{message}</div>
          <p className="rs-muted mt-1 max-w-2xl text-sm leading-6">{help}</p>
        </div>
      </div>
    </motion.div>
  );
}

function FilterDebugPanel({
  filters,
  serverCount,
  visibleCount,
}: {
  filters: ListingFilters;
  serverCount: number;
  visibleCount: number;
}) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_SHOW_DEBUG !== "true"
  ) {
    return null;
  }

  const queryParams = buildListingQueryParams(filters).toString();

  return (
    <details className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-muted)] shadow-[var(--shadow-soft)]">
      <summary className="cursor-pointer select-none font-semibold text-[var(--color-accent-strong)]">
        Dev filter debug
      </summary>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 font-semibold text-[var(--color-text)]">API query params</div>
          <pre className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
            {queryParams || "(none)"}
          </pre>
        </div>
        <div>
          <div className="mb-1 font-semibold text-[var(--color-text)]">Counts</div>
          <pre className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
            {JSON.stringify({ serverCount, visibleCount }, null, 2)}
          </pre>
        </div>
        <div>
          <div className="mb-1 font-semibold text-[var(--color-text)]">Frontend filter state</div>
          <pre className="max-h-80 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
            {JSON.stringify(filters, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}

function formatUpdatedAt(value: string | null, language: Language) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function DashboardPage() {
  const auth = useAuth();
  const isProUser = hasPro(auth.user);
  const [filters, setFilters] = useState<ListingFilters>(() => createInitialFilters());
  const [language, setLanguage] = useState<Language>("nl");
  const [searchStarted, setSearchStarted] = useState(false);
  const [listingsPage, setListingsPage] = useState<ListingsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraperFreshness, setScraperFreshness] = useState<ScraperFreshness | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [previewLockedOpen, setPreviewLockedOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [workflowState, setWorkflowState] = useState<LocalListingWorkflowState>({});
  const [searchProfiles, setSearchProfiles] = useState<SearchProfile[]>([]);
  const [configuredSources, setConfiguredSources] = useState<SourceInfo[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const toastId = useRef(0);
  const copy = i18n[language];

  const listings = useMemo(() => listingsPage?.items ?? [], [listingsPage]);
  const freeLimitApplied = listingsPage?.free_limit_applied ?? false;
  const requiresPro = listingsPage?.requires_pro ?? false;
  const totalListings = listingsPage?.total ?? 0;

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("rental-radar-language");
    const searchParams = new URLSearchParams(window.location.search);
    const forceSetup = searchParams.get("setup") === "1";

    if (storedLanguage === "nl" || storedLanguage === "en") {
      setLanguage(storedLanguage);
    }

    if (forceSetup) {
      window.localStorage.removeItem(onboardingStorageKey);
      window.history.replaceState(null, "", "/search");
    }

    setSearchStarted(!forceSetup && window.localStorage.getItem(onboardingStorageKey) === "done");
    setWorkflowState(loadListingWorkflowState());
    setSearchProfiles(loadSearchProfiles());
    void fetchSources()
      .then(setConfiguredSources)
      .catch(() => setConfiguredSources([]));
  }, []);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("rental-radar-language", nextLanguage);
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = toastId.current + 1;
      toastId.current = id;
      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 3600);
    },
    [],
  );

  const loadListings = useCallback(
    async (nextFilters: ListingFilters, token: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchListings(nextFilters, token);
        setListingsPage(data);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : copy.toast.fetchError;
        setError(message);
        showToast(copy.toast.fetchError, "error");
      } finally {
        setLoading(false);
      }
    },
    [copy.toast.fetchError, showToast],
  );

  const refreshScraperFreshness = useCallback(
    async (city: string, sourceIds?: string[]) => {
      try {
        const data = await fetchScraperFreshness(city, sourceIds);
        setScraperFreshness(data);
        return data;
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadListings(filters, auth.accessToken);
    }, 260);

    return () => window.clearTimeout(handle);
  }, [filters, loadListings, auth.accessToken]);

  useEffect(() => {
    if (!selectedListing) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedListing(null);
      }
    }

    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedListing]);

  const sources = useMemo(() => {
    return Array.from(
      new Set([
        ...configuredSources.map((source) => source.display_name),
        ...listings.map((listing) => listing.source).filter(Boolean),
      ]),
    ).sort();
  }, [configuredSources, listings]);

  const sourceCounts = useMemo(() => {
    return configuredSources.map((source) => ({
      ...source,
      count: listings.filter((listing) => listing.source === source.display_name).length,
    }));
  }, [configuredSources, listings]);
  const automaticSourceCounts = useMemo(
    () => sourceCounts.filter((source) => source.auto_scan_enabled),
    [sourceCounts],
  );
  const limitedSourceCounts = useMemo(
    () => sourceCounts.filter((source) => !source.auto_scan_enabled),
    [sourceCounts],
  );
  const sourceHealthStats = useMemo(() => {
    const automaticSources = configuredSources.filter((source) => source.auto_scan_enabled);
    const limitedSources = configuredSources.filter((source) => !source.auto_scan_enabled);
    const onlineSources = automaticSources.filter((source) =>
      source.status === "online" || source.status === "degraded",
    );
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const listingsAddedToday = listings.filter((listing) => {
      const firstSeen = new Date(listing.first_seen_at ?? listing.created_at);
      return !Number.isNaN(firstSeen.getTime()) && firstSeen >= startOfToday;
    }).length;

    return {
      automaticSources,
      limitedSources,
      onlineSources,
      listingsAddedToday,
    };
  }, [configuredSources, listings]);

  const visibleListings = useMemo(() => {
    return listings.filter((listing) => {
      const status = workflowStatusForListing(workflowState, listing);

      if (!filters.showHiddenListings && status === "hidden") {
        return false;
      }

      if (filters.status && status !== filters.status) {
        return false;
      }

      if (
        filters.propertyTypes.length > 0 &&
        !filters.propertyTypes.includes(listing.property_type)
      ) {
        return false;
      }

      if (
        filters.houseSubtypes.length > 0 &&
        listing.property_type === "house" &&
        !filters.houseSubtypes.includes(listing.property_type_sub as import("@/types/listing").HouseSubType)
      ) {
        return false;
      }

      return true;
    });
  }, [
    filters.houseSubtypes,
    filters.propertyTypes,
    filters.showHiddenListings,
    filters.status,
    listings,
    workflowState,
  ]);

  const stats = useMemo(() => {
    const pricedListings = visibleListings.filter((listing) => listing.price !== null);
    const lowestPrice = pricedListings.length
      ? Math.min(...pricedListings.map((listing) => listing.price ?? 0))
      : null;
    const privateCount = visibleListings.filter((listing) => listing.is_shared === false).length;
    const statusCounts = listings.reduce(
      (counts, listing) => {
        const status = workflowStatusForListing(workflowState, listing);
        counts[status] += 1;
        return counts;
      },
      {
        new: 0,
        interested: 0,
        applied: 0,
        viewing_planned: 0,
        rejected: 0,
        hidden: 0,
      } satisfies Record<ListingStatus, number>,
    );

    return {
      lowestPrice,
      privateCount,
      statusCounts,
    };
  }, [listings, visibleListings, workflowState]);

  const selectedListingStatus = selectedListing
    ? workflowStatusForListing(workflowState, selectedListing)
    : "new";
  const selectedListingNote = selectedListing
    ? workflowNoteForListing(workflowState, selectedListing)
    : "";
  const selectedProfile = searchProfiles.find((profile) => profile.id === selectedProfileId);
  const currentProfileFilters = useMemo(
    () => profileFiltersFromListingFilters(filters),
    [filters],
  );
  const newestFinishedAtLabel = formatUpdatedAt(
    scraperFreshness?.newest_finished_at ?? null,
    language,
  );
  const freshnessBySource = useMemo(() => {
    return new Map(
      (scraperFreshness?.sources ?? []).map((source) => [source.source_id, source]),
    );
  }, [scraperFreshness]);
  const hasUnsavedProfileChanges = selectedProfile
    ? !profileFiltersEqual(selectedProfile.filters, currentProfileFilters)
    : false;

  function updateSearchProfiles(nextProfiles: SearchProfile[]) {
    setSearchProfiles(nextProfiles);
    saveSearchProfiles(nextProfiles);
  }

  function handleSelectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    const profile = searchProfiles.find((item) => item.id === profileId);
    setProfileName(profile?.name ?? "");
  }

  function handleSaveProfile() {
    const name = profileName.trim();

    if (!name) {
      return;
    }

    const now = new Date().toISOString();
    const profile: SearchProfile = {
      id: createProfileId(),
      name,
      filters: currentProfileFilters,
      createdAt: now,
      updatedAt: now,
    };
    const nextProfiles = [...searchProfiles, profile];

    updateSearchProfiles(nextProfiles);
    setSelectedProfileId(profile.id);
    showToast(copy.searchProfiles.toast.saved, "success");
  }

  function handleApplyProfile() {
    if (!selectedProfile) {
      return;
    }

    setFilters(listingFiltersFromProfile(selectedProfile.filters, filters));
    setProfileName(selectedProfile.name);
    setSearchStarted(true);
    showToast(copy.searchProfiles.toast.applied, "success");
  }

  function handleUpdateProfile() {
    if (!selectedProfile) {
      return;
    }

    const name = profileName.trim() || selectedProfile.name;
    const nextProfiles = searchProfiles.map((profile) =>
      profile.id === selectedProfile.id
        ? {
            ...profile,
            name,
            filters: currentProfileFilters,
            updatedAt: new Date().toISOString(),
          }
        : profile,
    );

    updateSearchProfiles(nextProfiles);
    setProfileName(name);
    showToast(copy.searchProfiles.toast.updated, "success");
  }

  function handleDeleteProfile() {
    if (!selectedProfile) {
      return;
    }

    updateSearchProfiles(searchProfiles.filter((profile) => profile.id !== selectedProfile.id));
    setSelectedProfileId("");
    setProfileName("");
    showToast(copy.searchProfiles.toast.deleted, "success");
  }

  function updateWorkflowState(nextState: LocalListingWorkflowState) {
    setWorkflowState(nextState);
    saveListingWorkflowState(nextState);
  }

  function handleStatusChange(listing: Listing, status: ListingStatus) {
    const key = listingWorkflowKey(listing);
    const nextState = {
      ...workflowState,
      [key]: {
        ...workflowState[key],
        status,
        updatedAt: new Date().toISOString(),
      },
    };

    updateWorkflowState(nextState);
    showToast(
      status === "hidden" ? copy.workflow.toast.hiddenHelp : copy.workflow.toast[status],
      "success",
    );
  }

  function handleNoteChange(listing: Listing, note: string) {
    const key = listingWorkflowKey(listing);
    const nextState = {
      ...workflowState,
      [key]: {
        ...workflowState[key],
        status: workflowState[key]?.status ?? "new",
        note,
        updatedAt: new Date().toISOString(),
      },
    };

    updateWorkflowState(nextState);
  }

  function resetFilters() {
    setFilters(createInitialFilters());
  }

  function startSearch(values: Pick<
    ListingFilters,
    | "city"
    | "minPrice"
    | "maxPrice"
    | "noMaxPrice"
    | "propertyTypes"
    | "privateKitchen"
    | "privateBathroom"
    | "privateToilet"
    | "allowShared"
    | "allowSharedLaundry"
  >) {
    const city = values.city.trim();
    const selectedPropertyTypes = values.propertyTypes.filter(
      (type): type is PropertyType => ["studio", "apartment", "room", "house"].includes(type),
    );
    const nextFilters: ListingFilters = {
      ...filters,
      ...values,
      city,
      propertyType: "",
      propertyTypes: selectedPropertyTypes,
      offset: 0,
    };

    setFilters((current) => ({
      ...current,
      ...nextFilters,
      offset: 0,
    }));
    window.localStorage.setItem(onboardingStorageKey, "done");
    setSearchStarted(true);
  }

  function restartOnboarding() {
    window.localStorage.removeItem(onboardingStorageKey);
    setSearchStarted(false);
  }

  useEffect(() => {
    if (!searchStarted) {
      return;
    }

    const scraperCity = filters.city.trim() || "Breda";
    let cancelled = false;

    void refreshScraperFreshness(scraperCity).then((freshness) => {
      if (cancelled || !freshness) {
        return;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    filters.city,
    refreshScraperFreshness,
    searchStarted,
  ]);

  return (
    <div className="theme-dashboard min-h-screen">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
    <main className="relative isolate overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <ToastStack toasts={toasts} />

      <AnimatePresence mode="wait">
        {!searchStarted ? (
          <WelcomeScreen
            language={language}
            initialCity={filters.city}
            initialMaxRent={filters.maxPrice}
            onLanguageChange={changeLanguage}
            onStart={startSearch}
          />
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            className="mx-auto max-w-[92rem]"
          >
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="dashboard-shell mb-5 rounded-2xl p-5"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="dashboard-muted mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
                {copy.dashboard.eyebrow}
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-[var(--color-text)] sm:text-4xl">
                {copy.dashboard.title}
              </h1>
              <p className="dashboard-muted mt-3 max-w-2xl text-sm leading-6">
                {copy.dashboard.subtitle}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rs-chip-active rounded-full px-3 py-1.5 text-xs font-semibold">
                  {filters.city.trim()
                    ? `${copy.dashboard.scopeCity}: ${filters.city}`
                    : copy.dashboard.scopeAllNetherlands}
                </span>
                {filters.city.trim() ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        city: "",
                        offset: 0,
                      }))
                    }
                    className="rs-control rounded-full px-3 py-1.5 text-xs font-semibold"
                  >
                    {copy.dashboard.scopeAllNetherlands}
                  </button>
                ) : null}
              </div>
              {selectedProfile ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rs-chip-active rounded-full px-3 py-1.5 text-xs font-semibold">
                    {copy.searchProfiles.active}: {selectedProfile.name}
                  </span>
                  {hasUnsavedProfileChanges ? (
                    <span className="rs-chip rounded-full px-3 py-1.5 text-xs font-semibold">
                      {copy.searchProfiles.unsaved}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleUpdateProfile}
                    className="rs-control rounded-full px-3 py-1.5 text-xs font-semibold"
                  >
                    {copy.searchProfiles.update}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setQuickEditOpen((prev) => !prev)}
                className="rs-control mt-5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                {copy.dashboard.quickEditTitle}
              </button>
              <button
                type="button"
                onClick={restartOnboarding}
                className="rs-control ml-2 mt-5 rounded-full px-4 py-2 text-sm font-semibold"
              >
                {copy.dashboard.restartSetup}
              </button>
            </div>

            <div className="sm:min-w-[24rem]">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
                  <div className="rs-subtle text-xs uppercase tracking-[0.16em]">
                    {copy.dashboard.results}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                    <AnimatedValue value={visibleListings.length} />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
                  <div className="rs-subtle text-xs uppercase tracking-[0.16em]">
                    {copy.dashboard.private}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--color-teal)]">
                    <AnimatedValue value={stats.privateCount} />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3">
                  <div className="rs-subtle text-xs uppercase tracking-[0.16em]">
                    {copy.dashboard.lowestRent}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[var(--color-accent-strong)]">
                    <AnimatedValue
                      value={
                        stats.lowestPrice === null
                          ? copy.listing.notAvailable
                          : formatPrice(stats.lowestPrice, language)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <AnimatePresence>
          {quickEditOpen ? (
            <QuickEditPanel
              filters={filters}
              language={language}
              onClose={() => setQuickEditOpen(false)}
              onUpdate={(partial) => setFilters((prev) => ({ ...prev, ...partial }))}
            />
          ) : null}
        </AnimatePresence>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 grid gap-2 border-y border-[var(--color-border)] py-3 sm:grid-cols-5"
        >
          {[
            { label: copy.workflow.stats.visible, value: visibleListings.length },
            { label: copy.workflow.stats.interested, value: stats.statusCounts.interested },
            { label: copy.workflow.stats.applied, value: stats.statusCounts.applied },
            { label: copy.workflow.stats.viewing, value: stats.statusCounts.viewing_planned },
            { label: copy.workflow.stats.hidden, value: stats.statusCounts.hidden },
          ].map((item) => (
            <div key={item.label} className="px-2 py-2">
              <div className="dashboard-muted text-[10px] font-semibold uppercase tracking-[0.14em]">
                {item.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                <AnimatedValue value={item.value} />
              </div>
            </div>
          ))}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                status: "hidden",
                showHiddenListings: true,
                offset: 0,
              }))
            }
            className="px-2 py-2 text-left text-xs font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-text)] sm:col-span-5"
          >
            {copy.workflow.viewHidden}
          </motion.button>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <aside className="dashboard-shell sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl p-4 lg:block">
            <FilterPanel
              filters={filters}
              sources={sources}
              loading={loading}
              onChange={setFilters}
              onReset={resetFilters}
              language={language}
              hiddenCount={stats.statusCounts.hidden}
              profiles={searchProfiles}
              selectedProfileId={selectedProfileId}
              profileName={profileName}
              hasUnsavedProfileChanges={hasUnsavedProfileChanges}
              isProUser={isProUser}
              isAuthenticated={Boolean(auth.isAuthenticated)}
              onProfileNameChange={setProfileName}
              onSelectProfile={handleSelectProfile}
              onSaveProfile={handleSaveProfile}
              onApplyProfile={handleApplyProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={handleDeleteProfile}
            />
          </aside>

          <section className="min-w-0">
            {/* Result count + sort + active filters */}
            <div className="dashboard-shell mb-5 rounded-2xl p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">
                    {loading
                      ? copy.dashboard.refreshing
                      : requiresPro
                        ? `${visibleListings.length} ${copy.previewBanner.visibleCountOf} ${totalListings} ${copy.previewBanner.visibleCountSuffix}`
                        : freeLimitApplied
                          ? `${visibleListings.length} ${copy.previewBanner.visibleCountFree}`
                          : `${visibleListings.length} ${copy.dashboard.found}`}
                  </div>
                  <p className="dashboard-muted mt-1 text-xs">
                    {scraperFreshness?.is_fresh
                      ? copy.scraper.resultsRecent
                      : copy.dashboard.autoRefresh}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="rs-control h-11 rounded-xl px-4 text-sm font-semibold lg:hidden"
                >
                  {copy.dashboard.filters}
                </button>
              </div>

              {/* Sort chips */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(
                  [
                    { value: "best_match" as ListingSort, label: copy.filters.bestMatch },
                    { value: "newest" as ListingSort, label: copy.filters.newest },
                    { value: "cheapest" as ListingSort, label: copy.filters.cheapest },
                    { value: "most_expensive" as ListingSort, label: copy.filters.mostExpensive },
                    { value: "best_quality" as ListingSort, label: copy.filters.bestQuality },
                  ]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        sort: option.value,
                        offset: 0,
                      }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      filters.sort === option.value
                        ? "rs-chip-active"
                        : "rs-chip hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <ActiveFilters
                filters={filters}
                onChange={setFilters}
                language={language}
                onReset={resetFilters}
              />
              <FilterDebugPanel
                filters={filters}
                serverCount={totalListings}
                visibleCount={visibleListings.length}
              />
            </div>

            {/* Compact source bar — collapsed by default */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="dashboard-shell mb-5 rounded-2xl p-4"
            >
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-0.5">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-[var(--color-text)]">
                      {sourceHealthStats.onlineSources.length}{" "}
                      <span className="rs-muted font-normal">{copy.scraper.activeSources}</span>
                    </span>
                    {newestFinishedAtLabel ? (
                      <span className="rs-muted">
                        {copy.scraper.lastUpdated}: {newestFinishedAtLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="rs-subtle shrink-0 text-xs font-semibold transition hover:text-[var(--color-text)]">
                    {copy.scraper.viewSourceStatus} ›
                  </span>
                </summary>

                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {automaticSourceCounts.map((item) => {
                      const sourceFreshness = freshnessBySource.get(item.source_id);
                      const freshnessState = sourceFreshness?.state ?? "never_scanned";
                      const lastScan = item.last_scan_finished_at ?? sourceFreshness?.finished_at ?? null;

                      return (
                        <div
                          key={item.source_id}
                          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--color-text)]">
                              {item.display_name}
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              freshnessState === "recent"
                                ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]"
                                : freshnessState === "stale"
                                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]"
                                  : "bg-[var(--color-soft)] text-[var(--color-subtle)]"
                            }`}>
                              {copy.scraper.freshness[freshnessState]}
                            </span>
                          </div>
                          <div className="rs-muted mt-2 flex items-center justify-between gap-3 text-xs">
                            <span>{item.count} {copy.dashboard.results.toLowerCase()}</span>
                            {lastScan ? <span>{formatUpdatedAt(lastScan, language)}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {limitedSourceCounts.length ? (
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-soft)] px-3 py-2.5">
                      <div className="mb-2 text-xs font-semibold text-[var(--color-muted)]">
                        {copy.scraper.limitedManualSources} ({limitedSourceCounts.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {limitedSourceCounts.map((item) => (
                          <span
                            key={item.source_id}
                            className="rs-chip rounded-full px-3 py-1.5 text-xs font-semibold"
                            title={item.internal_reason ?? item.notes}
                          >
                            {item.display_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            </motion.section>

            {error ? (
              <ErrorPanel message={error} help={copy.toast.backendOfflineHelp} />
            ) : null}

            {loading ? (
              <SkeletonGrid />
            ) : visibleListings.length ? (
              <motion.div layout className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {visibleListings.map((listing, index) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      index={index}
                      onOpen={setSelectedListing}
                      onToast={showToast}
                      language={language}
                      status={workflowStatusForListing(workflowState, listing)}
                      onStatusChange={handleStatusChange}
                      previewOnly={Boolean(listingsPage?.preview_fields_only)}
                      onPreviewLocked={() => setPreviewLockedOpen(true)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <EmptyState language={language} />
            )}

            {!loading && requiresPro ? (
              <PreviewBanner
                visibleCount={listings.length}
                totalCount={totalListings}
                isGuest={!auth.user}
                banner={copy.previewBanner}
              />
            ) : null}

            {!loading && visibleListings.length <= 5 ? (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="dashboard-shell mt-6 rounded-2xl p-5"
              >
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {visibleListings.length === 0
                    ? copy.dashboard.zeroResultsTitle
                    : copy.dashboard.lowResultsTitle}
                </div>
                <p className="rs-muted mt-2 text-sm leading-6">
                  {visibleListings.length === 0
                    ? copy.dashboard.zeroResultsBody
                    : copy.dashboard.lowResultsBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {filters.city.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, city: "", offset: 0 }))
                      }
                      className="rs-control rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      {copy.dashboard.lowResultsActionAll}
                    </button>
                  ) : null}
                  {(filters.privateBathroom === true ||
                    filters.privateKitchen === true ||
                    filters.privateToilet === true ||
                    !filters.allowShared) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          privateBathroom: null,
                          privateKitchen: null,
                          privateToilet: null,
                          allowShared: true,
                          offset: 0,
                        }))
                      }
                      className="rs-control rounded-full px-4 py-2 text-sm font-semibold"
                    >
                      {copy.dashboard.lowResultsActionPrivacy}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setQuickEditOpen(true)}
                    className="rs-control rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    {copy.dashboard.lowResultsActionEdit}
                  </button>
                </div>
              </motion.section>
            ) : null}

            <ExternalSourcesPanel
              sources={configuredSources}
              city={filters.city}
              language={language}
              isProUser={isProUser}
            />
          </section>
        </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="h-full w-[min(92vw,24rem)] overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-page)] p-5 shadow-[var(--shadow-hover)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--color-text)]">{copy.dashboard.filters}</div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rs-control h-10 w-10 rounded-xl"
                  aria-label={copy.dashboard.closeFilters}
                >
                  x
                </button>
              </div>
              <FilterPanel
                filters={filters}
                sources={sources}
                loading={loading}
                onChange={setFilters}
                onReset={resetFilters}
                language={language}
                hiddenCount={stats.statusCounts.hidden}
                profiles={searchProfiles}
                selectedProfileId={selectedProfileId}
                profileName={profileName}
                hasUnsavedProfileChanges={hasUnsavedProfileChanges}
                onProfileNameChange={setProfileName}
                onSelectProfile={handleSelectProfile}
                onSaveProfile={handleSaveProfile}
                onApplyProfile={handleApplyProfile}
                onUpdateProfile={handleUpdateProfile}
                onDeleteProfile={handleDeleteProfile}
                isProUser={isProUser}
                isAuthenticated={Boolean(auth.isAuthenticated)}
              />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <ListingModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onToast={showToast}
        language={language}
        status={selectedListingStatus}
        onStatusChange={handleStatusChange}
        note={selectedListingNote}
        onNoteChange={handleNoteChange}
      />
      <AnimatePresence>
        {previewLockedOpen ? (
          <PreviewLockedDialog
            isGuest={!auth.user}
            language={language}
            onClose={() => setPreviewLockedOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </main>
    </div>
  );
}

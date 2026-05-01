"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ActiveFilters } from "@/components/dashboard/ActiveFilters";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { ListingCard } from "@/components/dashboard/ListingCard";
import { ListingModal } from "@/components/dashboard/ListingModal";
import { ScraperProgress } from "@/components/dashboard/ScraperProgress";
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
  runScraper,
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
  ListingStatus,
  LocalListingWorkflowState,
  PropertyType,
  ScraperFreshness,
  ScraperResult,
  SearchProfile,
  SourceInfo,
} from "@/types/listing";

const onboardingStorageKey = "rental-radar-onboarding-complete-v1";
const scanSourcesStorageKey = "rental-radar-scan-sources-v1";

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
      className="cinematic-panel mb-5 rounded-[1.5rem] border border-danger/30 bg-[linear-gradient(135deg,rgba(248,113,113,0.16),rgba(8,13,24,0.78)_46%,rgba(8,13,24,0.92))] p-4 text-sm shadow-cinematic backdrop-blur-2xl sm:p-5"
      role="status"
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-danger/30 bg-danger/12 text-base font-semibold text-danger shadow-[0_0_38px_rgba(248,113,113,0.16)]">
          !
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-white">{message}</div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/58">{help}</p>
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
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const queryParams = buildListingQueryParams(filters).toString();

  return (
    <details className="mt-5 rounded-2xl border border-cyan-100/20 bg-slate-950/70 p-4 text-xs text-white/60 shadow-cinematic backdrop-blur-2xl">
      <summary className="cursor-pointer select-none font-semibold text-cyan-100/80">
        Dev filter debug
      </summary>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 font-semibold text-white/70">API query params</div>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3">
            {queryParams || "(none)"}
          </pre>
        </div>
        <div>
          <div className="mb-1 font-semibold text-white/70">Counts</div>
          <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3">
            {JSON.stringify({ serverCount, visibleCount }, null, 2)}
          </pre>
        </div>
        <div>
          <div className="mb-1 font-semibold text-white/70">Frontend filter state</div>
          <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3">
            {JSON.stringify(filters, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  );
}

function normalizeSourceKey(sourceIds: string[]) {
  return [...sourceIds].sort().join(",");
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
  const [filters, setFilters] = useState<ListingFilters>(() => createInitialFilters());
  const [language, setLanguage] = useState<Language>("nl");
  const [searchStarted, setSearchStarted] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraperLoading, setScraperLoading] = useState(false);
  const [autoRefreshLoading, setAutoRefreshLoading] = useState(false);
  const [scraperResult, setScraperResult] = useState<ScraperResult | null>(null);
  const [scraperFreshness, setScraperFreshness] = useState<ScraperFreshness | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [workflowState, setWorkflowState] = useState<LocalListingWorkflowState>({});
  const [searchProfiles, setSearchProfiles] = useState<SearchProfile[]>([]);
  const [configuredSources, setConfiguredSources] = useState<SourceInfo[]>([]);
  const [selectedScanSourceIds, setSelectedScanSourceIds] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const toastId = useRef(0);
  const scraperRunInFlightRef = useRef(false);
  const autoRefreshKeyRef = useRef("");
  const copy = i18n[language];

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
      .then((sourcesData) => {
        setConfiguredSources(sourcesData);
        const storedSourceIds = window.localStorage.getItem(scanSourcesStorageKey);

        if (storedSourceIds) {
          try {
            const parsedSourceIds = JSON.parse(storedSourceIds);

            if (Array.isArray(parsedSourceIds)) {
              setSelectedScanSourceIds(
                parsedSourceIds.filter((sourceId): sourceId is string =>
                  sourcesData.some((source) => source.source_id === sourceId),
                ),
              );
              return;
            }
          } catch {
            window.localStorage.removeItem(scanSourcesStorageKey);
          }
        }

        setSelectedScanSourceIds(
          sourcesData
            .filter((source) => source.default_enabled_for_auto_scan)
            .map((source) => source.source_id),
        );
      })
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
    async (nextFilters: ListingFilters) => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchListings(nextFilters);
        setListings(data);
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
    async (city: string, sourceIds: string[]) => {
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
      void loadListings(filters);
    }, 260);

    return () => window.clearTimeout(handle);
  }, [filters, loadListings]);

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
        ...listings.map((listing) => listing.source),
      ]),
    ).sort();
  }, [configuredSources, listings]);

  const sourceCounts = useMemo(() => {
    return configuredSources.map((source) => ({
      ...source,
      count: listings.filter((listing) => listing.source === source.display_name).length,
    }));
  }, [configuredSources, listings]);

  function updateSelectedScanSourceIds(sourceIds: string[]) {
    setSelectedScanSourceIds(sourceIds);
    window.localStorage.setItem(scanSourcesStorageKey, JSON.stringify(sourceIds));
  }

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

      return true;
    });
  }, [
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

  const runScraperForFilters = useCallback(async (
    requestedFilters: ListingFilters,
    startMessage: string = copy.toast.scrapeStart,
    options: { automatic?: boolean } = {},
  ) => {
    if (scraperRunInFlightRef.current) {
      return;
    }

    const scraperCity = requestedFilters.city.trim() || "Breda";
    const nextFilters = {
      ...requestedFilters,
      city: scraperCity,
      offset: 0,
    };

    scraperRunInFlightRef.current = true;
    setScraperLoading(true);
    setAutoRefreshLoading(Boolean(options.automatic));
    setError(null);
    setScraperResult(null);

    if (!options.automatic) {
      showToast(startMessage, "info");
    }

    try {
      const result = await runScraper(scraperCity, selectedScanSourceIds);
      setScraperResult(result);
      if (!options.automatic) {
        showToast(copy.toast.scrapeSuccess, "success");
      }
      setFilters(nextFilters);
      await loadListings(nextFilters);
      await refreshScraperFreshness(scraperCity, selectedScanSourceIds);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : copy.toast.scrapeError;
      setError(message);
      showToast(copy.toast.scrapeError, "error");
    } finally {
      scraperRunInFlightRef.current = false;
      setScraperLoading(false);
      setAutoRefreshLoading(false);
    }
  }, [
    copy.toast.scrapeError,
    copy.toast.scrapeStart,
    copy.toast.scrapeSuccess,
    loadListings,
    refreshScraperFreshness,
    selectedScanSourceIds,
    showToast,
  ]);

  async function handleRunScraper() {
    await runScraperForFilters(filters);
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
    const city = values.city.trim() || "Breda";
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
    if (!searchStarted || !selectedScanSourceIds.length) {
      return;
    }

    const scraperCity = filters.city.trim() || "Breda";
    const sourceKey = normalizeSourceKey(selectedScanSourceIds);
    const refreshKey = `${scraperCity.toLowerCase()}|${sourceKey}`;

    if (autoRefreshKeyRef.current === refreshKey) {
      return;
    }

    autoRefreshKeyRef.current = refreshKey;

    let cancelled = false;

    void refreshScraperFreshness(scraperCity, selectedScanSourceIds).then((freshness) => {
      if (cancelled || !freshness || freshness.is_fresh || scraperRunInFlightRef.current) {
        return;
      }

      void runScraperForFilters(
        {
          ...filters,
          city: scraperCity,
          offset: 0,
        },
        copy.toast.scrapeStart,
        { automatic: true },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    copy.toast.scrapeStart,
    filters,
    refreshScraperFreshness,
    runScraperForFilters,
    searchStarted,
    selectedScanSourceIds,
  ]);

  return (
    <div className="min-h-screen bg-[#070a10] text-cream">
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
    <main className="relative isolate overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
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
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-premium"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/38">
                {copy.dashboard.eyebrow}
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {copy.dashboard.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/56">
                {copy.dashboard.subtitle}
              </p>
              {selectedProfile ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                    {copy.searchProfiles.active}: {selectedProfile.name}
                  </span>
                  {hasUnsavedProfileChanges ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/58">
                      {copy.searchProfiles.unsaved}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleUpdateProfile}
                    className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-white/62 transition hover:border-cyan-100/40 hover:text-white"
                  >
                    {copy.searchProfiles.update}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setSearchStarted(false)}
                className="mt-5 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-white/62 transition hover:border-cyan-100/40 hover:text-white"
              >
                {copy.dashboard.changeSearch}
              </button>
              <button
                type="button"
                onClick={restartOnboarding}
                className="ml-2 mt-5 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-white/62 transition hover:border-cyan-100/40 hover:text-white"
              >
                {copy.dashboard.restartSetup}
              </button>
            </div>

            <div className="sm:min-w-[24rem]">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/38">
                    {copy.dashboard.results}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    <AnimatedValue value={visibleListings.length} />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/38">
                    {copy.dashboard.private}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-mint">
                    <AnimatedValue value={stats.privateCount} />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/18 p-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/38">
                    {copy.dashboard.lowestRent}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-brass">
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

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 grid gap-2 border-y border-white/8 py-3 sm:grid-cols-5"
        >
          {[
            { label: copy.workflow.stats.visible, value: visibleListings.length },
            { label: copy.workflow.stats.interested, value: stats.statusCounts.interested },
            { label: copy.workflow.stats.applied, value: stats.statusCounts.applied },
            { label: copy.workflow.stats.viewing, value: stats.statusCounts.viewing_planned },
            { label: copy.workflow.stats.hidden, value: stats.statusCounts.hidden },
          ].map((item) => (
            <div key={item.label} className="px-2 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {item.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
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
            className="px-2 py-2 text-left text-xs font-semibold text-white/52 transition hover:text-white sm:col-span-5"
          >
            {copy.workflow.viewHidden}
          </motion.button>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1017] p-4 shadow-premium lg:block">
            <FilterPanel
              filters={filters}
              sources={sources}
              configuredSources={configuredSources}
              selectedScanSourceIds={selectedScanSourceIds}
              loading={loading}
              scraperLoading={scraperLoading}
              onChange={setFilters}
              onReset={resetFilters}
              onRunScraper={handleRunScraper}
              onScanSourceChange={updateSelectedScanSourceIds}
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
            />
          </aside>

          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-premium">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {loading
                      ? copy.dashboard.refreshing
                      : `${visibleListings.length} ${copy.dashboard.found}`}
                  </div>
                  <p className="mt-1 text-xs text-white/42">
                    {scraperFreshness?.is_fresh
                      ? copy.scraper.resultsRecent
                      : copy.dashboard.autoRefresh}
                  </p>
                  {newestFinishedAtLabel ? (
                    <p className="mt-1 text-xs text-white/42">
                      {copy.scraper.lastUpdated}: {newestFinishedAtLabel}
                    </p>
                  ) : null}
                </div>
                {autoRefreshLoading ? (
                  <span className="inline-flex h-9 items-center rounded-full border border-mint/25 bg-mint/10 px-3 text-xs font-semibold text-mint">
                    {copy.scraper.autoRefreshing}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="h-11 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white/70 transition hover:border-white/24 hover:text-white lg:hidden"
                >
                  {copy.dashboard.filters}
                </button>
              </div>
              <ActiveFilters filters={filters} onChange={setFilters} language={language} />
              <FilterDebugPanel
                filters={filters}
                serverCount={listings.length}
                visibleCount={visibleListings.length}
              />
            </div>

            <ScraperProgress
              loading={scraperLoading}
              result={scraperResult}
              language={language}
              automatic={autoRefreshLoading}
            />

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-premium"
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/38">
                {copy.scraper.sourceOverview}
              </div>
              <p className="mb-3 text-xs leading-5 text-white/42">
                {copy.scraper.sourceOverviewDescription}
              </p>
              <div className="flex flex-wrap gap-2">
                {sourceCounts.map((item) => {
                  const sourceFreshness = freshnessBySource.get(item.source_id);
                  const freshnessState = sourceFreshness?.state ?? "never_scanned";

                  return (
                    <span
                      key={item.source_id}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/62"
                    >
                      <span>{item.display_name} {item.count}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        item.supports_automatic_scraping
                          ? "bg-mint/10 text-mint"
                          : "bg-white/[0.06] text-white/42"
                      }`}
                      >
                        {item.supports_automatic_scraping
                          ? copy.scraper.automaticSource
                          : copy.scraper.limitedSource}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        freshnessState === "recent"
                          ? "bg-cyan-300/10 text-cyan-100"
                          : freshnessState === "stale"
                            ? "bg-brass/10 text-brass"
                            : "bg-white/[0.06] text-white/42"
                      }`}
                      >
                        {copy.scraper.freshness[freshnessState]}
                      </span>
                    </span>
                  );
                })}
              </div>
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
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <EmptyState onRunScraper={handleRunScraper} language={language} />
            )}
          </section>
        </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
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
              className="h-full w-[min(92vw,24rem)] overflow-y-auto border-r border-white/10 bg-[#10131a] p-5 shadow-premium"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{copy.dashboard.filters}</div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.05] text-white/60"
                  aria-label={copy.dashboard.closeFilters}
                >
                  x
                </button>
              </div>
              <FilterPanel
                filters={filters}
                sources={sources}
                configuredSources={configuredSources}
                selectedScanSourceIds={selectedScanSourceIds}
                loading={loading}
                scraperLoading={scraperLoading}
                onChange={setFilters}
                onReset={resetFilters}
                onRunScraper={handleRunScraper}
                onScanSourceChange={updateSelectedScanSourceIds}
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
    </main>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ListingFilters } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";
import { houseSubtypeLabel, propertyTypeLabel } from "./helpers";

type FilterPill = {
  key: keyof ListingFilters;
  label: string;
  resetValue: ListingFilters[keyof ListingFilters];
  clearKeys?: (keyof ListingFilters)[];
};

function boolLabel(value: boolean | null, language: Language) {
  const copy = i18n[language].activeFilters;

  if (value === true) {
    return copy.required;
  }

  if (value === false) {
    return copy.notPrivate;
  }

  return "";
}

function sortLabel(sort: ListingFilters["sort"], language: Language) {
  const copy = i18n[language].filters;

  switch (sort) {
    case "newest":
      return copy.newest;
    case "recently_updated":
      return copy.recentlyUpdated;
    case "cheapest":
      return copy.cheapest;
    case "most_expensive":
      return copy.mostExpensive;
    case "best_quality":
      return copy.bestQuality;
    case "best_match":
    default:
      return copy.bestMatch;
  }
}

export function getActiveFilters(filters: ListingFilters, language: Language): FilterPill[] {
  const copy = i18n[language].activeFilters;
  const pills: FilterPill[] = [];

  if (filters.search) {
    pills.push({ key: "search", label: `${copy.search}: ${filters.search}`, resetValue: "" });
  }
  if (filters.locationLat && filters.locationLabel) {
    pills.push({
      key: "locationLabel",
      label: `${copy.locationRadius}: ${filters.locationLabel} + ${filters.locationRadiusKm} km`,
      resetValue: "",
      clearKeys: ["locationLabel", "locationLat", "locationLng"],
    });
  } else if (filters.city) {
    pills.push({ key: "city", label: `${copy.city}: ${filters.city}`, resetValue: "" });
  }
  if (filters.source) {
    pills.push({ key: "source", label: `${copy.source}: ${filters.source}`, resetValue: "" });
  }
  if (filters.minPrice) {
    pills.push({ key: "minPrice", label: `${copy.minRent} ${filters.minPrice}`, resetValue: "" });
  }
  if (filters.maxPrice && !filters.noMaxPrice) {
    pills.push({ key: "maxPrice", label: `${copy.maxRent} ${filters.maxPrice}`, resetValue: "" });
  }
  if (filters.noMaxPrice) {
    pills.push({ key: "noMaxPrice", label: copy.noMaxPrice, resetValue: false });
  }
  if (!filters.includeUnknownPrice) {
    pills.push({
      key: "includeUnknownPrice",
      label: copy.knownPricesOnly,
      resetValue: true,
    });
  }
  if (filters.minAreaM2) {
    pills.push({ key: "minAreaM2", label: `${copy.minArea} ${filters.minAreaM2} m2`, resetValue: "" });
  }
  if (filters.maxAreaM2) {
    pills.push({ key: "maxAreaM2", label: `${copy.maxArea} ${filters.maxAreaM2} m2`, resetValue: "" });
  }
  if (filters.minRooms) {
    pills.push({ key: "minRooms", label: `${filters.minRooms}+ ${copy.rooms}`, resetValue: "" });
  }
  if (filters.propertyType) {
    pills.push({
      key: "propertyType",
      label: propertyTypeLabel(filters.propertyType, language),
      resetValue: "",
    });
  }
  if (filters.propertyTypes.length) {
    pills.push({
      key: "propertyTypes",
      label: filters.propertyTypes.map((type) => propertyTypeLabel(type, language)).join(", "),
      resetValue: [],
    });
  }
  if (filters.houseSubtypes.length) {
    pills.push({
      key: "houseSubtypes",
      label: filters.houseSubtypes.map((s) => houseSubtypeLabel(s, language) ?? s).join(", "),
      resetValue: [],
    });
  }
  if (filters.privateKitchen !== null) {
    pills.push({
      key: "privateKitchen",
      label: `${copy.kitchen} ${boolLabel(filters.privateKitchen, language)}`,
      resetValue: null,
    });
  }
  if (filters.privateBathroom !== null) {
    pills.push({
      key: "privateBathroom",
      label: `${copy.bathroom} ${boolLabel(filters.privateBathroom, language)}`,
      resetValue: null,
    });
  }
  if (filters.privateToilet !== null) {
    pills.push({
      key: "privateToilet",
      label: `${copy.toilet} ${boolLabel(filters.privateToilet, language)}`,
      resetValue: null,
    });
  }
  if (!filters.allowShared) {
    pills.push({ key: "allowShared", label: copy.noShared, resetValue: true });
  }
  if (!filters.allowSharedLaundry) {
    pills.push({
      key: "allowSharedLaundry",
      label: copy.noSharedLaundry,
      resetValue: true,
    });
  }
  if (filters.hasImage) {
    pills.push({ key: "hasImage", label: copy.hasImage, resetValue: false });
  }
  if (filters.seenRecentlyDays) {
    pills.push({
      key: "seenRecentlyDays",
      label: `${copy.seenRecently}: ${filters.seenRecentlyDays === "0" ? "0" : filters.seenRecentlyDays}d`,
      resetValue: "",
    });
  }
  if (filters.minConfidenceScore) {
    pills.push({
      key: "minConfidenceScore",
      label: `${copy.minQuality}: ${filters.minConfidenceScore}`,
      resetValue: "",
    });
  }
  if (filters.excludeWoningruil) {
    pills.push({ key: "excludeWoningruil", label: copy.excludeWoningruil, resetValue: false });
  }
  if (filters.excludeParking) {
    pills.push({ key: "excludeParking", label: copy.excludeParking, resetValue: false });
  }
  if (filters.hideRented) {
    pills.push({ key: "hideRented", label: copy.hideRented, resetValue: false });
  }
  if (filters.availableNow) {
    pills.push({ key: "availableNow", label: copy.availableNow, resetValue: false });
  }
  if (filters.onlyIndependent) {
    pills.push({ key: "onlyIndependent", label: copy.onlyIndependent, resetValue: false });
  }
  if (filters.status) {
    pills.push({
      key: "status",
      label: `${copy.status}: ${i18n[language].workflow.labels[filters.status]}`,
      resetValue: "",
    });
  }
  if (filters.showHiddenListings) {
    pills.push({
      key: "showHiddenListings",
      label: copy.showHiddenListings,
      resetValue: false,
    });
  } else {
    pills.push({
      key: "showHiddenListings",
      label: copy.hiddenExcluded,
      resetValue: true,
    });
  }
  if (filters.sort !== "newest") {
    pills.push({
      key: "sort",
      label: `${copy.sort}: ${sortLabel(filters.sort, language)}`,
      resetValue: "newest",
    });
  }

  return pills;
}

export function ActiveFilters({
  filters,
  onChange,
  language,
  onReset,
}: {
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
  language: Language;
  onReset?: () => void;
}) {
  const activeFilters = getActiveFilters(filters, language);
  const copy = i18n[language].activeFilters;
  const filtersCopy = i18n[language].filters;
  const hasRemovableFilters = activeFilters.some(
    (f) => f.key !== "showHiddenListings" && f.key !== "city",
  );

  return (
    <div className="min-h-10">
      <AnimatePresence initial={false}>
        {activeFilters.length ? (
          <motion.div layout className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <motion.button
                key={filter.key}
                type="button"
                layout
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                aria-label={`${filter.label} ${copy.remove}`}
                onClick={() => {
                  const cleared: Partial<ListingFilters> = { [filter.key]: filter.resetValue };
                  if (filter.clearKeys) {
                    for (const k of filter.clearKeys) {
                      (cleared as Record<string, unknown>)[k] = "";
                    }
                  }
                  onChange({ ...filters, ...cleared, offset: 0 });
                }}
                className="rs-chip rounded-full px-3 py-1.5 text-xs font-medium transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
              >
                {filter.label} <span className="rs-subtle ml-1">×</span>
              </motion.button>
            ))}
            {onReset && hasRemovableFilters ? (
              <motion.button
                type="button"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onReset}
                className="rs-subtle px-1.5 py-1.5 text-xs font-semibold underline underline-offset-2 transition hover:text-[var(--color-text)]"
              >
                {filtersCopy.reset}
              </motion.button>
            ) : null}
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rs-subtle text-sm"
          >
            {copy.none}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

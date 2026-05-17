import type {
  ListingFilters,
  SearchProfile,
  SearchProfileFilters,
} from "@/types/listing";
import { createInitialFilters } from "@/components/dashboard/helpers";

export const searchProfilesStorageKey = "rental-radar-search-profiles-v1";

export function loadSearchProfiles(): SearchProfile[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(searchProfilesStorageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as SearchProfile[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function saveSearchProfiles(profiles: SearchProfile[]) {
  window.localStorage.setItem(searchProfilesStorageKey, JSON.stringify(profiles));
}

export function createProfileId() {
  return `profile:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

export function profileFiltersFromListingFilters(
  filters: ListingFilters,
): SearchProfileFilters {
  return {
    city: filters.city,
    location_label: filters.locationLabel || undefined,
    location_lat: filters.locationLat || undefined,
    location_lng: filters.locationLng || undefined,
    location_radius_km: filters.locationLat ? filters.locationRadiusKm : undefined,
    source: filters.source,
    min_price: filters.minPrice,
    max_price: filters.maxPrice,
    no_max_price: filters.noMaxPrice,
    include_unknown_price: filters.includeUnknownPrice,
    min_area_m2: filters.minAreaM2,
    max_area_m2: filters.maxAreaM2,
    min_rooms: filters.minRooms,
    property_type: filters.propertyType,
    property_types: filters.propertyTypes,
    house_subtypes: filters.houseSubtypes.length > 0 ? filters.houseSubtypes : undefined,
    private_kitchen: filters.privateKitchen,
    private_bathroom: filters.privateBathroom,
    private_toilet: filters.privateToilet,
    allow_shared: filters.allowShared,
    allow_shared_laundry: filters.allowSharedLaundry,
    has_image: filters.hasImage,
    seen_recently_days: filters.seenRecentlyDays,
    min_confidence_score: filters.minConfidenceScore,
    exclude_woningruil: filters.excludeWoningruil,
    exclude_parking: filters.excludeParking,
    hide_rented: filters.hideRented,
    available_now: filters.availableNow,
    only_independent: filters.onlyIndependent,
    excluded_sources: filters.excludedSources,
    status: filters.status,
    show_hidden_listings: filters.showHiddenListings,
    search: filters.search,
    sort: filters.sort,
  };
}

export function listingFiltersFromProfile(
  profileFilters: SearchProfileFilters,
  currentFilters: ListingFilters,
): ListingFilters {
  const defaults = createInitialFilters();

  return {
    ...defaults,
    city: profileFilters.city,
    locationLabel: profileFilters.location_label ?? "",
    locationLat: profileFilters.location_lat ?? "",
    locationLng: profileFilters.location_lng ?? "",
    locationRadiusKm: profileFilters.location_radius_km ?? 20,
    source: profileFilters.source,
    minPrice: profileFilters.min_price,
    maxPrice: profileFilters.max_price,
    noMaxPrice: profileFilters.no_max_price,
    includeUnknownPrice: profileFilters.include_unknown_price,
    minAreaM2: profileFilters.min_area_m2,
    maxAreaM2: profileFilters.max_area_m2,
    minRooms: profileFilters.min_rooms,
    propertyType: profileFilters.property_type,
    propertyTypes: profileFilters.property_types ?? [],
    houseSubtypes: (profileFilters.house_subtypes ?? []) as import("@/types/listing").HouseSubType[],
    privateKitchen: profileFilters.private_kitchen,
    privateBathroom: profileFilters.private_bathroom,
    privateToilet: profileFilters.private_toilet,
    allowShared: profileFilters.allow_shared,
    allowSharedLaundry: profileFilters.allow_shared_laundry,
    hasImage: profileFilters.has_image,
    seenRecentlyDays: profileFilters.seen_recently_days,
    minConfidenceScore: profileFilters.min_confidence_score,
    excludeWoningruil: profileFilters.exclude_woningruil,
    excludeParking: profileFilters.exclude_parking,
    hideRented: profileFilters.hide_rented ?? true,
    availableNow: profileFilters.available_now ?? false,
    onlyIndependent: profileFilters.only_independent,
    excludedSources: profileFilters.excluded_sources ?? [],
    status: profileFilters.status ?? currentFilters.status,
    showHiddenListings:
      profileFilters.show_hidden_listings ?? currentFilters.showHiddenListings,
    search: profileFilters.search,
    sort: profileFilters.sort,
    offset: 0,
  };
}

export function profileFiltersEqual(
  left: SearchProfileFilters,
  right: SearchProfileFilters,
) {
  return JSON.stringify(normalizeProfileFilters(left)) === JSON.stringify(normalizeProfileFilters(right));
}

function normalizeProfileFilters(filters: SearchProfileFilters): SearchProfileFilters {
  return {
    ...filters,
    property_types: filters.property_types ?? [],
    status: filters.status ?? "",
    show_hidden_listings: filters.show_hidden_listings ?? false,
  };
}

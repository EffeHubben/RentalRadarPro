import type {
  Listing,
  ListingFilters,
  ListingsPage,
  LocationSuggestion,
  ScraperFreshness,
  ScraperResult,
  SourceInfo,
} from "@/types/listing";
import { buildApiUrl, getApiErrorMessage } from "@/lib/apiConfig";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export function buildListingQueryParams(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.city.trim()) {
    params.set("city", filters.city.trim());
  }

  if (filters.locationLat && filters.locationLng) {
    params.set("location_lat", filters.locationLat);
    params.set("location_lng", filters.locationLng);
    params.set("radius_km", String(filters.locationRadiusKm || 20));
  }

  if (filters.source.trim()) {
    params.set("source", filters.source.trim());
  }

  if (filters.minPrice.trim()) {
    params.set("min_price", filters.minPrice.trim());
  }

  if (filters.maxPrice.trim() && !filters.noMaxPrice) {
    params.set("max_price", filters.maxPrice.trim());
  }

  params.set("no_max_price", String(filters.noMaxPrice));
  params.set("include_unknown_price", String(filters.includeUnknownPrice));

  if (filters.minAreaM2.trim()) {
    params.set("min_area_m2", filters.minAreaM2.trim());
  }

  if (filters.maxAreaM2.trim()) {
    params.set("max_area_m2", filters.maxAreaM2.trim());
  }

  if (filters.minRooms.trim()) {
    params.set("min_rooms", filters.minRooms.trim());
  }

  if (filters.propertyTypes.length) {
    params.set("property_types", filters.propertyTypes.join(","));
  } else if (filters.propertyType) {
    params.set("property_type", filters.propertyType);
  }

  if (filters.privateKitchen !== null) {
    params.set("private_kitchen", String(filters.privateKitchen));
  }

  if (filters.privateBathroom !== null) {
    params.set("private_bathroom", String(filters.privateBathroom));
  }

  if (filters.privateToilet !== null) {
    params.set("private_toilet", String(filters.privateToilet));
  }

  params.set("allow_shared", String(filters.allowShared));
  params.set("allow_shared_laundry", String(filters.allowSharedLaundry));
  params.set("exclude_woningruil", String(filters.excludeWoningruil));
  params.set("exclude_parking", String(filters.excludeParking));
  params.set("hide_rented", String(filters.hideRented));
  params.set("available_now", String(filters.availableNow));
  params.set("only_independent", String(filters.onlyIndependent));

  if (filters.excludedSources.length) {
    params.set("exclude_sources", filters.excludedSources.join(","));
  }

  if (filters.hasImage) {
    params.set("has_image", "true");
  }

  if (filters.seenRecentlyDays) {
    params.set("seen_recently_days", filters.seenRecentlyDays);
  }

  if (filters.minConfidenceScore) {
    params.set("min_confidence_score", filters.minConfidenceScore);
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  params.set("sort", filters.sort);
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));

  return params;
}

export async function fetchListings(
  filters: ListingFilters,
  accessToken?: string | null,
): Promise<ListingsPage> {
  const params = buildListingQueryParams(filters);
  const query = params.toString();

  return request<ListingsPage>(`/listings/${query ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export async function runScraper(city?: string, sources?: string[]): Promise<ScraperResult> {
  const normalizedCity = city?.trim();
  const body = {
    ...(normalizedCity ? { city: normalizedCity } : {}),
    ...(sources ? { sources } : {}),
  };

  return request<ScraperResult>("/scrapers/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchScraperFreshness(
  city?: string,
  sources?: string[],
): Promise<ScraperFreshness> {
  const params = new URLSearchParams();
  const normalizedCity = city?.trim();

  if (normalizedCity) {
    params.set("city", normalizedCity);
  }

  if (sources?.length) {
    params.set("sources", sources.join(","));
  }

  const query = params.toString();

  return request<ScraperFreshness>(`/scrapers/freshness${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
}

export async function fetchListingById(
  id: number,
  accessToken?: string,
): Promise<Listing> {
  return request<Listing>(`/listings/${id}`, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export async function fetchSources(): Promise<SourceInfo[]> {
  return request<SourceInfo[]>("/sources/", {
    cache: "no-store",
  });
}

export async function fetchLocationSuggestions(q: string): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ q });
  return request<LocationSuggestion[]>(`/locations/suggest?${params.toString()}`, {
    cache: "no-store",
  });
}

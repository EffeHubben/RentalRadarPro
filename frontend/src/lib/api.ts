import type { Listing, ListingFilters, ScraperResult, SourceInfo } from "@/types/listing";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function buildListingQueryParams(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.city.trim()) {
    params.set("city", filters.city.trim());
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
  params.set("only_independent", String(filters.onlyIndependent));

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

export async function fetchListings(filters: ListingFilters): Promise<Listing[]> {
  const params = buildListingQueryParams(filters);
  const query = params.toString();

  return request<Listing[]>(`/api/listings/${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
}

export async function runScraper(city?: string, sources?: string[]): Promise<ScraperResult> {
  const normalizedCity = city?.trim();
  const body = {
    ...(normalizedCity ? { city: normalizedCity } : {}),
    ...(sources?.length ? { sources } : {}),
  };

  return request<ScraperResult>("/api/scrapers/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSources(): Promise<SourceInfo[]> {
  return request<SourceInfo[]>("/api/sources/", {
    cache: "no-store",
  });
}

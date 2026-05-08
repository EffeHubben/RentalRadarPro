export type Listing = {
  id: number;
  title: string;
  source: string;
  source_key: string | null;
  url: string;
  city: string | null;
  price: number | null;
  area_m2: number | null;
  rooms: number | null;
  property_type: PropertyType;
  private_kitchen: boolean | null;
  private_bathroom: boolean | null;
  private_toilet: boolean | null;
  shared_laundry: boolean | null;
  is_shared: boolean | null;
  is_woningruil: boolean;
  availability_status: AvailabilityStatus;
  is_available: boolean | null;
  confidence_score: number | null;
  image_url: string | null;
  description: string | null;
  address_text: string | null;
  street_name: string | null;
  house_number: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  location_precision: LocationPrecision;
  location_confidence: number;
  duplicate_key: string | null;
  canonical_key: string | null;
  duplicate_group_id: string | null;
  source_count: number;
  duplicate_sources: DuplicateSource[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_checked_at: string | null;
};

export type PropertyType =
  | "studio"
  | "apartment"
  | "room"
  | "house"
  | "parking"
  | "unknown";

export type AvailabilityStatus =
  | "available"
  | "under_option"
  | "reserved"
  | "rented"
  | "unknown";

export type DuplicateSource = {
  id: number;
  source: string;
  url: string;
  title: string;
};

export type LocationPrecision =
  | "exact_address"
  | "street"
  | "postcode"
  | "city"
  | "unknown";

export type ListingsPage = {
  items: Listing[];
  total: number;
  visible_count: number;
  free_limit_applied: boolean;
  requires_pro: boolean;
  preview_fields_only: boolean;
};

export type ListingSort =
  | "best_match"
  | "newest"
  | "recently_updated"
  | "cheapest"
  | "most_expensive"
  | "best_quality";

export type ListingStatus =
  | "new"
  | "interested"
  | "applied"
  | "viewing_planned"
  | "rejected"
  | "hidden";

export type LocalListingWorkflow = {
  status: ListingStatus;
  note?: string;
  updatedAt: string;
};

export type LocalListingWorkflowState = Record<string, LocalListingWorkflow>;

export type SearchProfileFilters = {
  city: string;
  source: string;
  min_price: string;
  max_price: string;
  no_max_price: boolean;
  include_unknown_price: boolean;
  min_area_m2: string;
  max_area_m2: string;
  min_rooms: string;
  property_type: PropertyType | "";
  property_types: PropertyType[];
  private_kitchen: boolean | null;
  private_bathroom: boolean | null;
  private_toilet: boolean | null;
  allow_shared: boolean;
  allow_shared_laundry: boolean;
  has_image: boolean;
  seen_recently_days: "" | "0" | "3" | "7" | "14";
  min_confidence_score: string;
  exclude_woningruil: boolean;
  exclude_parking: boolean;
  hide_rented: boolean;
  available_now?: boolean;
  only_independent: boolean;
  excluded_sources?: string[];
  status: ListingStatus | "";
  show_hidden_listings: boolean;
  search: string;
  sort: ListingSort;
};

export type SearchProfile = {
  id: string;
  name: string;
  filters: SearchProfileFilters;
  createdAt: string;
  updatedAt: string;
};

export type ListingFilters = {
  city: string;
  source: string;
  excludedSources: string[];
  minPrice: string;
  maxPrice: string;
  noMaxPrice: boolean;
  includeUnknownPrice: boolean;
  minAreaM2: string;
  maxAreaM2: string;
  minRooms: string;
  propertyType: PropertyType | "";
  propertyTypes: PropertyType[];
  privateKitchen: boolean | null;
  privateBathroom: boolean | null;
  privateToilet: boolean | null;
  allowShared: boolean;
  allowSharedLaundry: boolean;
  hasImage: boolean;
  seenRecentlyDays: "" | "0" | "3" | "7" | "14";
  minConfidenceScore: string;
  excludeWoningruil: boolean;
  excludeParking: boolean;
  hideRented: boolean;
  availableNow: boolean;
  onlyIndependent: boolean;
  status: ListingStatus | "";
  showHiddenListings: boolean;
  search: string;
  sort: ListingSort;
  limit: number;
  offset: number;
};

export type ScraperResult = {
  status: string;
  city: string;
  sources: Array<{
    source_id?: string;
    source: string;
    status?: "success" | "no_results" | "blocked" | "failed";
    scraped_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    duplicate_count?: number;
    error?: string | null;
    duration_ms?: number | null;
    manual_search_url?: string | null;
  }>;
  scraped_count: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  skipped_count: number;
  created_listings: Array<{
    id: number;
    title: string;
    source?: string;
    price: number | null;
    area_m2: number | null;
    rooms: number | null;
    image_url: string | null;
    url: string;
  }>;
};

export type SourceFreshnessState = "recent" | "stale" | "never_scanned";

export type SourceFreshness = {
  source_id: string;
  source: string;
  status: "success" | "no_results" | "blocked" | "failed" | null;
  scraped_count: number;
  created_count: number;
  updated_count: number;
  error?: string | null;
  started_at: string | null;
  finished_at: string | null;
  is_fresh: boolean;
  state: SourceFreshnessState;
};

export type ScraperFreshness = {
  city: string;
  sources: SourceFreshness[];
  newest_finished_at: string | null;
  oldest_finished_at: string | null;
  is_fresh: boolean;
  stale_sources: string[];
  freshness_window_minutes: number;
};

export type SourceType =
  | "direct_scraper"
  | "generic_html"
  | "rss"
  | "sitemap"
  | "manual"
  | "partner"
  | "api";

export type SourceInfo = {
  source_id: string;
  display_name: string;
  enabled: boolean;
  supports_city_search: boolean;
  base_url: string;
  source_key: string;
  category: "marketplace" | "landlord" | "housing-corporation" | "aggregator" | "manual";
  auto_scan_enabled: boolean;
  scan_interval_minutes: number;
  max_timeout_seconds: number;
  status: "online" | "degraded" | "offline" | "limited" | "manual";
  last_scan_started_at: string | null;
  last_scan_finished_at: string | null;
  last_success_at: string | null;
  last_failed_at?: string | null;
  last_error?: string | null;
  last_failed_error?: string | null;
  listings_found_last_scan: number;
  listings_added_today?: number;
  total_listing_count?: number;
  active_listing_count?: number;
  internal_reason?: string | null;
  next_due_at?: string | null;
  notes: string;
  manual_search_url_template?: string | null;
  manual_search_url?: string | null;
  default_enabled_for_auto_scan: boolean;
  supports_automatic_scraping: boolean;
  status_note_nl?: string | null;
  status_note_en?: string | null;
  country?: string;
  source_type?: SourceType;
  supported_cities?: string[] | null;
  supports_pagination?: boolean;
  requires_detail_page?: boolean;
  likely_blocks_bots?: boolean;
  priority?: number;
  reliability_weight?: number;
  last_run?: {
    source_id?: string;
    source: string;
    status: "success" | "no_results" | "blocked" | "failed";
    scraped_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    duplicate_count?: number;
    error?: string | null;
    duration_ms?: number | null;
    manual_search_url?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
  } | null;
};

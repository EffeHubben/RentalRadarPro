import type { SourceInfo } from "@/types/listing";

export type AdminOverview = {
  total_users: number;
  free_users: number;
  pro_users: number;
  active_subscriptions: number;
  canceled_subscriptions: number;
  past_due_subscriptions: number;
  inactive_subscriptions: number;
  total_listings: number;
  recent_registrations_count: number;
  recent_email_deliveries_count: number;
  total_sources: number;
  online_sources: number;
};

export type AdminUser = {
  id: number;
  email: string;
  display_name: string | null;
  plan: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
  email_verified: boolean;
  created_at: string;
  is_admin: boolean;
};

export type AdminUsersResponse = {
  total: number;
  items: AdminUser[];
};

export type AdminEmailDelivery = {
  id: number;
  user_id: number | null;
  email_type: string;
  delivery_status: "sent";
  provider_message_id: string | null;
  created_at: string;
};

export type AdminEmailDeliveriesResponse = {
  items: AdminEmailDelivery[];
  table_available: boolean;
  status_tracking_limited: boolean;
  available_email_types: string[];
};

export type AdminUserSegment =
  | "all"
  | "free"
  | "pro"
  | "admin"
  | "inactive"
  | "past_due"
  | "canceled";

export type AdminEmailDeliveryStatus = "all" | "sent" | "failed";

export type AdminSourcesResponse = SourceInfo[];

export type AnalyticsTodayStats = {
  page_views: number;
  searches: number;
  listing_views: number;
  open_clicks: number;
  unique_sessions: number;
  total_events: number;
};

export type AnalyticsTrendDay = {
  date: string;
  count: number;
};

export type AdminAnalyticsOverview = {
  today: AnalyticsTodayStats;
  trend_7d: AnalyticsTrendDay[];
};

export type AdminAnalyticsLive = {
  active_sessions: number;
};

export type AdminHealth = {
  database: { status: string; latency_ms: number | null; error?: string | null };
  scanner: {
    status: string;
    last_run_at: string | null;
    age_minutes: number | null;
    city: string | null;
    source_id: string | null;
  };
  scanner_recent_failures: Array<{
    city: string | null;
    source_id: string | null;
    status: string;
    error: string | null;
    finished_at: string | null;
  }>;
  config: {
    email_configured: boolean;
    stripe_configured: boolean;
    email_verification_enabled: boolean;
  };
  uptime_history: Array<{
    service: string;
    status: string;
    checked_at: string;
    latency_ms: number | null;
    error: string | null;
  }>;
  checked_at: string;
};

export type AdminScanEntry = {
  id: number;
  source_id: string;
  city: string | null;
  status: string;
  scraped_count: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  duration_ms: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type AdminScansResponse = {
  items: AdminScanEntry[];
  total: number;
  window_hours: number;
};

export type AdminSourceHealth = {
  source_id: string;
  display_name: string;
  auto_scan_enabled: boolean;
  scans_total: number;
  scans_success: number;
  scans_failed: number;
  scans_blocked: number;
  scans_no_results: number;
  success_rate: number;
  listings_created: number;
  last_status: string | null;
  last_finished_at: string | null;
  last_error: string | null;
  is_cooling_down: boolean;
  next_due_at: string | null;
};

export type AdminScanHealthResponse = {
  items: AdminSourceHealth[];
  window_hours: number;
  generated_at: string;
};

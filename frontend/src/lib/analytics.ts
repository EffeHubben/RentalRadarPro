import { buildApiUrl } from "@/lib/apiConfig";

const SESSION_KEY = "rs_sid";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function getReferrerDomain(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    if (!document.referrer) return undefined;
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}

let lastEventKey = "";

export type AnalyticsEventType =
  | "page_view"
  | "search_view"
  | "listing_view"
  | "open_listing_click"
  | "signup_started"
  | "signup_completed"
  | "checkout_started"
  | "account_view"
  | "search_filter_used";

export interface TrackEventPayload {
  path?: string;
  listing_id?: number;
  city?: string;
  metadata?: Record<string, unknown>;
}

export function trackEvent(type: AnalyticsEventType, data: TrackEventPayload = {}): void {
  if (typeof window === "undefined") return;

  const dedupeKey = `${type}:${data.path ?? window.location.pathname}:${data.listing_id ?? ""}`;
  if (dedupeKey === lastEventKey) return;
  lastEventKey = dedupeKey;

  const payload = {
    event_type: type,
    anonymous_session_id: getSessionId(),
    path: data.path ?? window.location.pathname,
    listing_id: data.listing_id,
    city: data.city,
    referrer_domain: getReferrerDomain(),
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
  };

  try {
    fetch(buildApiUrl("/analytics/event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw from tracking
  }
}

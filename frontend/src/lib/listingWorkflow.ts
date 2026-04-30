import type {
  Listing,
  ListingStatus,
  LocalListingWorkflowState,
} from "@/types/listing";

export const listingStatuses: ListingStatus[] = [
  "new",
  "interested",
  "applied",
  "viewing_planned",
  "rejected",
  "hidden",
];

export const listingWorkflowStorageKey = "rental-radar-listing-workflow-v1";

export function listingWorkflowKey(listing: Pick<Listing, "id" | "url">) {
  return listing.id ? `id:${listing.id}` : `url:${listing.url}`;
}

export function loadListingWorkflowState(): LocalListingWorkflowState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(listingWorkflowStorageKey);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as LocalListingWorkflowState;
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

export function saveListingWorkflowState(state: LocalListingWorkflowState) {
  window.localStorage.setItem(listingWorkflowStorageKey, JSON.stringify(state));
}

export function workflowStatusForListing(
  state: LocalListingWorkflowState,
  listing: Listing,
): ListingStatus {
  return state[listingWorkflowKey(listing)]?.status ?? "new";
}

export function workflowNoteForListing(
  state: LocalListingWorkflowState,
  listing: Listing,
) {
  return state[listingWorkflowKey(listing)]?.note ?? "";
}

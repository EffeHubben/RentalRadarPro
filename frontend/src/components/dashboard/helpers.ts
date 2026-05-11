import type { Listing, ListingFilters, PropertyType, HouseSubType } from "@/types/listing";
import { i18n, type Language } from "@/lib/i18n";

export function propertyTypeLabel(type: PropertyType, language: Language) {
  return i18n[language].propertyTypes[type];
}

export function houseSubtypeLabel(subtype: string | null | undefined, language: Language): string | null {
  if (!subtype) return null;
  const subtypes = i18n[language].houseSubtypes;
  return (subtypes as Record<string, string>)[subtype] ?? null;
}

export function listingTypeLabel(
  propertyType: PropertyType,
  propertySub: string | null | undefined,
  language: Language,
): string {
  if (propertyType === "house" && propertySub && propertySub !== "other_house") {
    return houseSubtypeLabel(propertySub, language) ?? propertyTypeLabel(propertyType, language);
  }
  return propertyTypeLabel(propertyType, language);
}

export function formatPrice(price: number | null, language: Language = "nl") {
  if (price === null) {
    return i18n[language].listing.priceUnknown;
  }

  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatArea(area: number | null | undefined, language: Language = "nl") {
  if (!area) {
    return i18n[language].listing.notAvailable;
  }

  return `${new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", {
    maximumFractionDigits: 0,
  }).format(area)} m²`;
}

export function compactText(value: string | null | undefined, maxLength: number) {
  const normalized = cleanDisplayText(value);

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trim()}...`
    : normalized;
}

export function cleanDisplayText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  let cleaned = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "";
  }

  const rawPatterns = [
    /\b[a-z][a-z0-9_]*\.[a-z0-9_.]+\b/gi,
    /\b(?:price_condition|price_type|rental_price|object_type|available_from|service_costs|deposit)\b\s*[:=]?\s*/gi,
    /\b(?:per_month|per month|p\/m|pm)\b/gi,
    /\b(?:null|undefined|none|nan)\b/gi,
  ];

  for (const pattern of rawPatterns) {
    cleaned = cleaned.replace(pattern, " ");
  }

  return cleaned
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(?:^|\s)[|•]{1,2}(?:\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.:|\-\s]+|[,.:|\-\s]+$/g, "")
    .trim();
}

export function cleanTitle(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = cleanDisplayText(value);

  if (!normalized) {
    return "";
  }

  const noisyPatterns = [
    /\bmeer op onze site\b/gi,
    /\bte huur:\s*/gi,
    /\bnieuw!\s*/gi,
    /\bnieuw\s*:\s*/gi,
    /\bvraag een bezichtiging aan via de link onderaan deze advertentie!?\b/gi,
    /\bgevonden voor\s*€\s*[0-9][0-9.,]*\b/gi,
    /\bappartement gevonden in [^,.]+,\s*nu beschikbaar voor.*$/gi,
    /\bstudio gevonden in [^,.]+,\s*nu beschikbaar voor.*$/gi,
    /\b(?:marktplaats|funda|ikwilhuren|mvgm)\s*[-|:]\s*/gi,
    /\b(?:breda|tilburg|eindhoven|rotterdam|amsterdam)\s*[-|:]\s*(?:breda|tilburg|eindhoven|rotterdam|amsterdam)\b/gi,
  ];
  const denoised = noisyPatterns.reduce(
    (title, pattern) => title.replace(pattern, "").trim().replace(/^[,.:|\-\s]+|[,.:|\-\s]+$/g, ""),
    normalized,
  );
  const splitMarkers = [
    " Gelieve ",
    " Deze ",
    " Dit ",
    " Bij binnenkomst ",
    " Gelegen ",
    " Bekijk ",
    " Vraag ",
    " Vanaf ",
  ];

  const cleaned = splitMarkers.reduce((title, marker) => {
    if (title.includes(marker) && title.indexOf(marker) > 18) {
      return title.split(marker)[0];
    }

    return title;
  }, denoised || normalized);

  return compactText(cleaned, 86);
}

export function createSummary(listing: Listing, maxLength = 155) {
  const title = cleanTitle(listing.title);
  const rawTitle = typeof listing.title === "string" ? listing.title : "";
  const sourceText = typeof listing.description === "string" && listing.description.trim()
    ? listing.description
    : title;

  if (!sourceText) {
    return "";
  }

  const withoutDuplicateTitle = cleanDisplayText(sourceText)
    .replace(rawTitle, "")
    .replace(title, "")
    .replace(/meer op onze site/gi, "")
    .replace(/vraag een bezichtiging aan via de link onderaan deze advertentie!?/gi, "")
    .replace(/gevonden voor\s*€\s*[0-9][0-9.,]*/gi, "")
    .replace(/\bnieuw!\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return compactText(withoutDuplicateTitle || sourceText, maxLength);
}

export function createListingSubtitle(listing: Listing, language: Language = "nl") {
  const parts = [
    [listing.postal_code, listing.city].filter(Boolean).join(" "),
    formatPrice(listing.price, language),
    listing.area_m2 ? formatArea(listing.area_m2, language) : "",
  ].filter((part) => part && part !== i18n[language].listing.priceUnknown);

  return parts.join(" · ");
}

export function descriptionSections(description: string | null, language: Language = "nl") {
  const cleaned = cleanDisplayText(description);

  if (!cleaned) {
    return [i18n[language].listing.fullDescriptionUnavailable];
  }

  const chunks = cleaned.match(/.{1,320}(?:\s|$)/g) ?? [cleaned];

  return chunks.map((chunk) => chunk.trim()).filter(Boolean).slice(0, 5);
}

export function listingDate(listing: Listing, language: Language = "nl") {
  const dateValue = listing.first_seen_at ?? listing.created_at;

  if (!dateValue) {
    return i18n[language].listing.recentlySeen;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return i18n[language].listing.recentlySeen;
  }

  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function createInitialFilters(): ListingFilters {
  return {
    city: "",
    source: "",
    excludedSources: [],
    minPrice: "",
    maxPrice: "",
    noMaxPrice: false,
    includeUnknownPrice: true,
    minAreaM2: "",
    maxAreaM2: "",
    minRooms: "",
    propertyType: "",
    propertyTypes: [],
    houseSubtypes: [],
    privateKitchen: null,
    privateBathroom: null,
    privateToilet: null,
    allowShared: true,
    allowSharedLaundry: true,
    hasImage: false,
    seenRecentlyDays: "",
    minConfidenceScore: "",
    excludeWoningruil: false,
    excludeParking: false,
    hideRented: true,
    availableNow: false,
    onlyIndependent: false,
    status: "",
    showHiddenListings: false,
    search: "",
    sort: "best_match",
    limit: 10,
    offset: 0,
  };
}

export function featureLabel(value: boolean | null, positive: string, negative: string, language: Language = "nl") {
  if (value === true) {
    return positive;
  }

  if (value === false) {
    return negative;
  }

  return i18n[language].listing.unknown;
}

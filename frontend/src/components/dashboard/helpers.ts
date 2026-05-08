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

export function compactText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trim()}...`
    : normalized;
}

export function cleanTitle(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();

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

  return compactText(cleaned, 78);
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

  const withoutDuplicateTitle = sourceText
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

export function descriptionSections(description: string | null, language: Language = "nl") {
  if (!description?.trim()) {
    return [i18n[language].listing.fullDescriptionUnavailable];
  }

  const normalized = description.replace(/\s+/g, " ").trim();
  const chunks = normalized.match(/.{1,320}(?:\s|$)/g) ?? [normalized];

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
    sort: "newest",
    limit: 50,
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

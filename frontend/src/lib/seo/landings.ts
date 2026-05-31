import type { PropertyType } from "@/types/listing";
import type { Metadata } from "next";

export type SeoCitySlug =
  | "amsterdam"
  | "breda"
  | "den-haag"
  | "eindhoven"
  | "groningen"
  | "maastricht"
  | "nijmegen"
  | "rotterdam"
  | "tilburg"
  | "utrecht";

export type SeoPropertyTypeSlug = "appartement" | "kamer" | "studio";

export type SeoFaqItem = {
  question: string;
  answer: string;
};

export type SafeListingPreview = {
  price: number;
  city: string;
  location: string;
  propertyType: PropertyType;
};

export type SeoCityLandingConfig = {
  citySlug: SeoCitySlug;
  cityName: string;
  province: string;
  title: string;
  metaDescription: string;
  introText: string;
  popularPropertyTypes: SeoPropertyTypeSlug[];
  suggestedBudgetRanges: string[];
  nearbyCities: SeoCitySlug[];
  ctaSearchFilters: {
    city: string;
    minPrice?: string;
    maxPrice?: string;
  };
  safePreviewListings: SafeListingPreview[];
};

export type SeoLandingKind = "city" | "typeCity";

export type SeoLandingConfig = {
  slug: string;
  kind: SeoLandingKind;
  city: SeoCityLandingConfig;
  propertyTypeSlug: SeoPropertyTypeSlug | null;
  title: string;
  metaDescription: string;
  introText: string;
  popularPropertyTypes: SeoPropertyTypeSlug[];
  suggestedBudgetRanges: string[];
  nearbyCities: SeoCitySlug[];
  ctaSearchFilters: {
    city: string;
    propertyType?: PropertyType;
    minPrice?: string;
    maxPrice?: string;
  };
  benefits: string[];
  faq: SeoFaqItem[];
};

export const SEO_PROPERTY_TYPE_ROUTE_PREFIX: Record<SeoPropertyTypeSlug, string> = {
  appartement: "appartement-huren",
  studio: "studio-huren",
  kamer: "kamer-huren",
};

const SEO_PROPERTY_TYPE_TO_LISTING_TYPE: Record<SeoPropertyTypeSlug, PropertyType> = {
  appartement: "apartment",
  studio: "studio",
  kamer: "room",
};

const SEO_PROPERTY_TYPE_LABEL: Record<SeoPropertyTypeSlug, string> = {
  appartement: "appartement",
  studio: "studio",
  kamer: "kamer",
};

const CITY_LANDING_CONFIGS: SeoCityLandingConfig[] = [
  {
    citySlug: "breda",
    cityName: "Breda",
    province: "Noord-Brabant",
    title: "Huurwoning Breda | RentScout",
    metaDescription:
      "Zoek een huurwoning in Breda met RentScout. Vergelijk listings uit meerdere bronnen, herken dubbele advertenties en houd je zoekworkflow overzichtelijk.",
    introText:
      "Op zoek naar een huurwoning in Breda? RentScout bundelt externe huuradvertenties in een werkruimte zodat je sneller kunt vergelijken en reageren.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 800 - EUR 1.100", "EUR 1.100 - EUR 1.500", "EUR 1.500+"],
    nearbyCities: ["tilburg", "rotterdam", "eindhoven"],
    ctaSearchFilters: { city: "Breda", minPrice: "700", maxPrice: "1700" },
    safePreviewListings: [
      { city: "Breda", location: "Centrum", price: 1225, propertyType: "apartment" },
      { city: "Breda", location: "Belcrum", price: 915, propertyType: "studio" },
      { city: "Breda", location: "Princenhage", price: 760, propertyType: "room" },
      { city: "Breda", location: "Brabantpark", price: 1340, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "rotterdam",
    cityName: "Rotterdam",
    province: "Zuid-Holland",
    title: "Huurwoning Rotterdam | RentScout",
    metaDescription:
      "Vind huurwoningen in Rotterdam via RentScout. Bekijk brontransparantie, vergelijk sneller en voorkom dubbel werk bij dezelfde woning op meerdere sites.",
    introText:
      "Een huurwoning in Rotterdam vinden vraagt snelheid en overzicht. RentScout helpt je listings uit meerdere bronnen te combineren in een rustige workflow.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 900 - EUR 1.300", "EUR 1.300 - EUR 1.900", "EUR 1.900+"],
    nearbyCities: ["den-haag", "breda", "utrecht"],
    ctaSearchFilters: { city: "Rotterdam", minPrice: "850", maxPrice: "2100" },
    safePreviewListings: [
      { city: "Rotterdam", location: "Kralingen", price: 1490, propertyType: "apartment" },
      { city: "Rotterdam", location: "Delfshaven", price: 990, propertyType: "studio" },
      { city: "Rotterdam", location: "Noord", price: 780, propertyType: "room" },
      { city: "Rotterdam", location: "Feijenoord", price: 1360, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "utrecht",
    cityName: "Utrecht",
    province: "Utrecht",
    title: "Huurwoning Utrecht | RentScout",
    metaDescription:
      "Zoek huurwoningen in Utrecht met RentScout. Vergelijk listings op een plek, sla zoekprofielen op en beheer je reacties zonder tab-chaos.",
    introText:
      "Voor een huurwoning in Utrecht wil je geen tijd verliezen aan versnipperde zoekresultaten. RentScout geeft je een centrale huurzoek-werkruimte.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 900 - EUR 1.250", "EUR 1.250 - EUR 1.850", "EUR 1.850+"],
    nearbyCities: ["amsterdam", "rotterdam", "nijmegen"],
    ctaSearchFilters: { city: "Utrecht", minPrice: "850", maxPrice: "2000" },
    safePreviewListings: [
      { city: "Utrecht", location: "Lombok", price: 1540, propertyType: "apartment" },
      { city: "Utrecht", location: "Wittevrouwen", price: 1040, propertyType: "studio" },
      { city: "Utrecht", location: "Overvecht", price: 770, propertyType: "room" },
      { city: "Utrecht", location: "Leidsche Rijn", price: 1395, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "amsterdam",
    cityName: "Amsterdam",
    province: "Noord-Holland",
    title: "Huurwoning Amsterdam | RentScout",
    metaDescription:
      "Huurwoning in Amsterdam zoeken? Gebruik RentScout om listings uit meerdere bronnen te vergelijken, doublures te herkennen en je reactieproces te organiseren.",
    introText:
      "De Amsterdamse huurmarkt is snel. RentScout helpt je met een overzichtelijke workflow om bronnen te combineren, vergelijken en opvolgen.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 1.100 - EUR 1.500", "EUR 1.500 - EUR 2.300", "EUR 2.300+"],
    nearbyCities: ["utrecht", "den-haag", "rotterdam"],
    ctaSearchFilters: { city: "Amsterdam", minPrice: "1000", maxPrice: "2600" },
    safePreviewListings: [
      { city: "Amsterdam", location: "West", price: 1980, propertyType: "apartment" },
      { city: "Amsterdam", location: "Noord", price: 1290, propertyType: "studio" },
      { city: "Amsterdam", location: "Oost", price: 910, propertyType: "room" },
      { city: "Amsterdam", location: "Nieuw-West", price: 1640, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "eindhoven",
    cityName: "Eindhoven",
    province: "Noord-Brabant",
    title: "Huurwoning Eindhoven | RentScout",
    metaDescription:
      "Bekijk huurwoningen in Eindhoven met RentScout. Krijg een veilige preview, transparante broninformatie en een praktische workflow voor actieve huurzoekers.",
    introText:
      "In Eindhoven wil je snel nieuwe kansen zien zonder overzicht te verliezen. RentScout bundelt externe listings en helpt je rustig prioriteren.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 850 - EUR 1.200", "EUR 1.200 - EUR 1.700", "EUR 1.700+"],
    nearbyCities: ["tilburg", "breda", "maastricht"],
    ctaSearchFilters: { city: "Eindhoven", minPrice: "800", maxPrice: "1900" },
    safePreviewListings: [
      { city: "Eindhoven", location: "Strijp", price: 1410, propertyType: "apartment" },
      { city: "Eindhoven", location: "Woensel", price: 970, propertyType: "studio" },
      { city: "Eindhoven", location: "Gestel", price: 735, propertyType: "room" },
      { city: "Eindhoven", location: "Centrum", price: 1575, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "tilburg",
    cityName: "Tilburg",
    province: "Noord-Brabant",
    title: "Huurwoning Tilburg | RentScout",
    metaDescription:
      "Zoek een huurwoning in Tilburg via RentScout. Vergelijk resultaten uit meerdere bronnen, voorkom dubbele advertenties en beheer je reacties op een plek.",
    introText:
      "Voor Tilburg combineert RentScout listings uit externe bronnen in een centrale werkruimte zodat je sneller een shortlist maakt.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 750 - EUR 1.050", "EUR 1.050 - EUR 1.450", "EUR 1.450+"],
    nearbyCities: ["breda", "eindhoven", "rotterdam"],
    ctaSearchFilters: { city: "Tilburg", minPrice: "700", maxPrice: "1650" },
    safePreviewListings: [
      { city: "Tilburg", location: "Centrum", price: 1160, propertyType: "apartment" },
      { city: "Tilburg", location: "Oud-Noord", price: 850, propertyType: "studio" },
      { city: "Tilburg", location: "Reeshof", price: 705, propertyType: "room" },
      { city: "Tilburg", location: "Korvel", price: 1290, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "den-haag",
    cityName: "Den Haag",
    province: "Zuid-Holland",
    title: "Huurwoning Den Haag | RentScout",
    metaDescription:
      "Huurwoningen in Den Haag vinden? Gebruik RentScout voor brontransparantie, veilige previews en een huurzoek-workflow met minder ruis.",
    introText:
      "De huurmarkt in Den Haag beweegt snel. RentScout helpt je externe listings te bundelen en gericht op te volgen in een duidelijke workflow.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 900 - EUR 1.300", "EUR 1.300 - EUR 1.900", "EUR 1.900+"],
    nearbyCities: ["rotterdam", "amsterdam", "utrecht"],
    ctaSearchFilters: { city: "Den Haag", minPrice: "850", maxPrice: "2100" },
    safePreviewListings: [
      { city: "Den Haag", location: "Centrum", price: 1520, propertyType: "apartment" },
      { city: "Den Haag", location: "Laak", price: 980, propertyType: "studio" },
      { city: "Den Haag", location: "Segbroek", price: 790, propertyType: "room" },
      { city: "Den Haag", location: "Scheveningen", price: 1710, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "groningen",
    cityName: "Groningen",
    province: "Groningen",
    title: "Huurwoning Groningen | RentScout",
    metaDescription:
      "Bekijk huurwoningen in Groningen met RentScout. Krijg een veilig listing-overzicht, broncontext en hulp om sneller te vergelijken.",
    introText:
      "In Groningen helpt RentScout je om relevante externe listings te verzamelen en je huurzoektocht gestructureerd te beheren.",
    popularPropertyTypes: ["kamer", "studio", "appartement"],
    suggestedBudgetRanges: ["EUR 650 - EUR 900", "EUR 900 - EUR 1.250", "EUR 1.250+"],
    nearbyCities: ["nijmegen", "utrecht", "amsterdam"],
    ctaSearchFilters: { city: "Groningen", minPrice: "600", maxPrice: "1500" },
    safePreviewListings: [
      { city: "Groningen", location: "Binnenstad", price: 1080, propertyType: "apartment" },
      { city: "Groningen", location: "Paddepoel", price: 790, propertyType: "studio" },
      { city: "Groningen", location: "Helpman", price: 675, propertyType: "room" },
      { city: "Groningen", location: "Oosterpoort", price: 1185, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "nijmegen",
    cityName: "Nijmegen",
    province: "Gelderland",
    title: "Huurwoning Nijmegen | RentScout",
    metaDescription:
      "Zoek een huurwoning in Nijmegen met RentScout. Vergelijk listings uit meerdere bronnen, houd status bij en reageer sneller vanuit een werkruimte.",
    introText:
      "Nijmegen combineren met omliggende zoekgebieden? RentScout maakt het makkelijker om externe listings te vergelijken en doublures te signaleren.",
    popularPropertyTypes: ["appartement", "studio", "kamer"],
    suggestedBudgetRanges: ["EUR 750 - EUR 1.050", "EUR 1.050 - EUR 1.500", "EUR 1.500+"],
    nearbyCities: ["utrecht", "eindhoven", "maastricht"],
    ctaSearchFilters: { city: "Nijmegen", minPrice: "700", maxPrice: "1750" },
    safePreviewListings: [
      { city: "Nijmegen", location: "Centrum", price: 1260, propertyType: "apartment" },
      { city: "Nijmegen", location: "Lent", price: 930, propertyType: "studio" },
      { city: "Nijmegen", location: "Hatert", price: 720, propertyType: "room" },
      { city: "Nijmegen", location: "Oost", price: 1410, propertyType: "apartment" },
    ],
  },
  {
    citySlug: "maastricht",
    cityName: "Maastricht",
    province: "Limburg",
    title: "Huurwoning Maastricht | RentScout",
    metaDescription:
      "Vind huurwoningen in Maastricht via RentScout. Ontvang brontransparantie, een veilige preview en workflow-tools om je zoektocht beter te beheren.",
    introText:
      "Voor een huurwoning in Maastricht helpt RentScout je met een overzichtelijke werkruimte waarin je listings, status en reacties op een plek houdt.",
    popularPropertyTypes: ["appartement", "kamer", "studio"],
    suggestedBudgetRanges: ["EUR 700 - EUR 1.000", "EUR 1.000 - EUR 1.450", "EUR 1.450+"],
    nearbyCities: ["eindhoven", "nijmegen", "tilburg"],
    ctaSearchFilters: { city: "Maastricht", minPrice: "650", maxPrice: "1700" },
    safePreviewListings: [
      { city: "Maastricht", location: "Wyck", price: 1240, propertyType: "apartment" },
      { city: "Maastricht", location: "Randwyck", price: 890, propertyType: "studio" },
      { city: "Maastricht", location: "Brusselsepoort", price: 690, propertyType: "room" },
      { city: "Maastricht", location: "Biesland", price: 1360, propertyType: "apartment" },
    ],
  },
];

function buildDefaultFaq(cityName: string, propertyTypeSlug: SeoPropertyTypeSlug | null): SeoFaqItem[] {
  const typeLabel = propertyTypeSlug ? SEO_PROPERTY_TYPE_LABEL[propertyTypeSlug] : "huurwoning";

  return [
    {
      question: `Hoe helpt RentScout bij ${typeLabel} zoeken in ${cityName}?`,
      answer:
        "RentScout bundelt externe huuradvertenties in een werkruimte met broncontext, statusbeheer, notities en snelle vergelijking.",
    },
    {
      question: "Toont RentScout de originele bron van een listing?",
      answer:
        "Ja. Waar beschikbaar zie je de broninformatie en kun je door naar de originele advertentie om prijs, voorwaarden en beschikbaarheid te controleren.",
    },
    {
      question: "Welke data is zichtbaar in de publieke preview?",
      answer:
        "Publieke preview toont maximaal 10 listings met alleen prijs, stad/locatie en woningtype. Premium details blijven achter de Pro Pass.",
    },
  ];
}

function buildTypeCityTitle(typeSlug: SeoPropertyTypeSlug, cityName: string): string {
  return `${SEO_PROPERTY_TYPE_LABEL[typeSlug]} huren ${cityName} | RentScout`;
}

function buildTypeCityDescription(typeSlug: SeoPropertyTypeSlug, cityName: string): string {
  return `Zoek ${SEO_PROPERTY_TYPE_LABEL[typeSlug]}s in ${cityName} met RentScout. Vergelijk listings uit meerdere bronnen, herken doublures en beheer je reacties op een plek.`;
}

function buildTypeCityIntro(typeSlug: SeoPropertyTypeSlug, cityName: string): string {
  return `Wil je een ${SEO_PROPERTY_TYPE_LABEL[typeSlug]} huren in ${cityName}? RentScout combineert externe listings in een zoekwerkruimte zodat je sneller kunt vergelijken en opvolgen.`;
}

function buildCitySlug(citySlug: SeoCitySlug): string {
  return `huurwoning-${citySlug}`;
}

function buildTypeCitySlug(typeSlug: SeoPropertyTypeSlug, citySlug: SeoCitySlug): string {
  return `${SEO_PROPERTY_TYPE_ROUTE_PREFIX[typeSlug]}-${citySlug}`;
}

function buildCommonBenefits(cityName: string): string[] {
  return [
    `Vind huuradvertenties in ${cityName} uit meerdere externe bronnen.`,
    "Herken sneller dubbele advertenties en vergelijk met minder ruis.",
    "Bewaar zoekprofielen, notities en status per woning in een workflow.",
    "Werk met tenant profile en reactie-assistent zodra je actief reageert.",
  ];
}

const LANDING_BY_SLUG = new Map<string, SeoLandingConfig>();

for (const city of CITY_LANDING_CONFIGS) {
  const citySlug = buildCitySlug(city.citySlug);
  LANDING_BY_SLUG.set(citySlug, {
    slug: citySlug,
    kind: "city",
    city,
    propertyTypeSlug: null,
    title: city.title,
    metaDescription: city.metaDescription,
    introText: city.introText,
    popularPropertyTypes: city.popularPropertyTypes,
    suggestedBudgetRanges: city.suggestedBudgetRanges,
    nearbyCities: city.nearbyCities,
    ctaSearchFilters: {
      city: city.ctaSearchFilters.city,
      minPrice: city.ctaSearchFilters.minPrice,
      maxPrice: city.ctaSearchFilters.maxPrice,
    },
    benefits: buildCommonBenefits(city.cityName),
    faq: buildDefaultFaq(city.cityName, null),
  });

  for (const typeSlug of city.popularPropertyTypes) {
    const typeCitySlug = buildTypeCitySlug(typeSlug, city.citySlug);
    LANDING_BY_SLUG.set(typeCitySlug, {
      slug: typeCitySlug,
      kind: "typeCity",
      city,
      propertyTypeSlug: typeSlug,
      title: buildTypeCityTitle(typeSlug, city.cityName),
      metaDescription: buildTypeCityDescription(typeSlug, city.cityName),
      introText: buildTypeCityIntro(typeSlug, city.cityName),
      popularPropertyTypes: city.popularPropertyTypes,
      suggestedBudgetRanges: city.suggestedBudgetRanges,
      nearbyCities: city.nearbyCities,
      ctaSearchFilters: {
        city: city.ctaSearchFilters.city,
        propertyType: SEO_PROPERTY_TYPE_TO_LISTING_TYPE[typeSlug],
        minPrice: city.ctaSearchFilters.minPrice,
        maxPrice: city.ctaSearchFilters.maxPrice,
      },
      benefits: buildCommonBenefits(city.cityName),
      faq: buildDefaultFaq(city.cityName, typeSlug),
    });
  }
}

export function getCityLandingConfig(citySlug: SeoCitySlug): SeoCityLandingConfig | null {
  return CITY_LANDING_CONFIGS.find((entry) => entry.citySlug === citySlug) ?? null;
}

export function getSeoLandingBySlug(slug: string): SeoLandingConfig | null {
  return LANDING_BY_SLUG.get(slug) ?? null;
}

export function buildSeoLandingMetadata(landing: SeoLandingConfig): Metadata {
  const canonical = getCanonicalPath(landing.slug);
  return {
    title: landing.title,
    description: landing.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: landing.title,
      description: landing.metaDescription,
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary",
      title: landing.title,
      description: landing.metaDescription,
    },
  };
}

export function getAllSeoLandingSlugs(): string[] {
  return Array.from(LANDING_BY_SLUG.keys());
}

export function getSeoLandingStaticParams(): Array<{ landingSlug: string }> {
  return getAllSeoLandingSlugs().map((landingSlug) => ({ landingSlug }));
}

export function getCanonicalPath(slug: string): string {
  return `/${slug}`;
}

export function buildSearchHref(filters: {
  city: string;
  propertyType?: PropertyType;
  minPrice?: string;
  maxPrice?: string;
}): string {
  const params = new URLSearchParams();
  params.set("city", filters.city);

  if (filters.propertyType) {
    params.set("property_type", filters.propertyType);
  }

  if (filters.minPrice) {
    params.set("min_price", filters.minPrice);
  }

  if (filters.maxPrice) {
    params.set("max_price", filters.maxPrice);
  }

  return `/search?${params.toString()}`;
}

export function getSafePreviewListings(
  cityConfig: SeoCityLandingConfig,
  propertyType?: PropertyType,
): SafeListingPreview[] {
  const filtered = propertyType
    ? cityConfig.safePreviewListings.filter((item) => item.propertyType === propertyType)
    : cityConfig.safePreviewListings;

  const normalized = filtered.map((item) => ({
    price: item.price,
    city: item.city,
    location: item.location,
    propertyType: item.propertyType,
  }));

  return normalized.slice(0, 10);
}

export function getNearbyLandingLinks(city: SeoCityLandingConfig): Array<{ slug: string; cityName: string }> {
  return city.nearbyCities
    .map((slug) => {
      const config = getCityLandingConfig(slug);
      if (!config) return null;
      return { slug: buildCitySlug(config.citySlug), cityName: config.cityName };
    })
    .filter((item): item is { slug: string; cityName: string } => Boolean(item));
}

export function getTypeLandingLinks(city: SeoCityLandingConfig): Array<{ slug: string; label: string }> {
  return city.popularPropertyTypes.map((typeSlug) => ({
    slug: buildTypeCitySlug(typeSlug, city.citySlug),
    label: `${SEO_PROPERTY_TYPE_LABEL[typeSlug]} huren ${city.cityName}`,
  }));
}

export function getSeoSitemapPaths(): string[] {
  return getAllSeoLandingSlugs().map((slug) => `/${slug}`);
}

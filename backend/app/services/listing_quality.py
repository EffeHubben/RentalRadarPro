from __future__ import annotations

import re
from dataclasses import dataclass


KNOWN_CITY_NAMES = [
    "Amsterdam",
    "Rotterdam",
    "Den Haag",
    "Utrecht",
    "Eindhoven",
    "Groningen",
    "Tilburg",
    "Almere",
    "Breda",
    "Nijmegen",
    "Enschede",
    "Haarlem",
    "Arnhem",
    "Amersfoort",
    "Apeldoorn",
    "Zwolle",
    "Leiden",
    "Maastricht",
    "Dordrecht",
    "Ede",
    "Leeuwarden",
    "Delft",
    "Deventer",
    "Helmond",
    "Alkmaar",
    "Venlo",
    "Roosendaal",
    "Gouda",
    "Oss",
    "Drachten",
    "Oosterhout",
    "Veldhoven",
    "Waalwijk",
    "Gorinchem",
    "Bergen op Zoom",
    "Made",
    "Terheijden",
    "Prinsenbeek",
    "Teteringen",
    "Etten-Leur",
    "Rijen",
    "Oosterhout",
    "Zevenbergen",
]

# House compound terms: checked first via word-boundary regex so that words like
# "slaapkamer" or "woonkamer" never trigger the "room" classification.
_HOUSE_COMPOUND_RE = re.compile(
    r"\b(?:"
    r"rijtjeshuis|tussenwoning|rijwoning|hoekwoning|hoekhuis|hoekpand"
    r"|twee-onder-een-kap|2-onder-1-kap|halfvrijstaand|geschakelde\s+woning"
    r"|vrijstaande?\s+woning|vrijstaand\s+huis|woonhuis|herenhuis|grachtenpand"
    r"|eengezinswoning|gezinswoning|bungalow|villa"
    r")\b",
    re.IGNORECASE,
)
# Generic house words matched as whole tokens (not as substrings of e.g. "huurwoning").
_HUIS_WONING_RE = re.compile(r"\b(?:huis|woning|house)\b", re.IGNORECASE)
# "kamer" matched as a whole word: does NOT match slaapkamer / woonkamer / eetkamer.
_KAMER_WORD_RE = re.compile(r"\b(?:kamer|studentenkamer)\b", re.IGNORECASE)

PROPERTY_TYPE_KEYWORDS = {
    "parking": [
        "parkeerplaats",
        "parking",
        "garagebox",
        "parkeergarage",
        "stalling",
    ],
    "studio": ["studio", "studiowoning"],
    # House keyword list intentionally mirrors _HOUSE_COMPOUND_RE for keyword-based paths.
    "house": [
        "woonhuis", "eengezinswoning", "gezinswoning", "tussenwoning",
        "rijtjeshuis", "hoekwoning", "hoekhuis", "twee-onder-een-kap",
        "2-onder-1-kap", "halfvrijstaand", "herenhuis", "bungalow", "villa",
    ],
    "apartment": ["appartement", "apartment", "flat", "maisonnette", "penthouse"],
    # "woonruimte" and "room" (EN) are safe substrings; "kamer" is handled via _KAMER_WORD_RE.
    "room": ["woonruimte", "room"],
}

HOUSE_SUBTYPE_KEYWORDS: dict[str, list[str]] = {
    "terraced_house": ["rijtjeshuis", "tussenwoning", "rijwoning"],
    "corner_house": ["hoekwoning", "hoekhuis", "hoekpand"],
    "semi_detached_house": ["twee-onder-een-kap", "2-onder-1-kap", "halfvrijstaand", "geschakelde woning"],
    "detached_house": ["vrijstaand", "vrijstaande woning", "vrijstaand huis"],
    "family_house": ["eengezinswoning", "gezinswoning"],
    "townhouse": ["herenhuis", "grachtenpand"],
    "bungalow": ["bungalow"],
    "villa": ["villa"],
}

APARTMENT_SUBTYPE_KEYWORDS: dict[str, list[str]] = {
    "maisonette": ["maisonnette", "maisonette"],
    "penthouse": ["penthouse"],
    "ground_floor_apartment": ["begane grond", "parterre", "gelijkvloers"],
    "upstairs_apartment": ["bovenwoning"],
}

PRIVATE_KITCHEN_KEYWORDS = [
    "eigen keuken",
    "open keuken",
    "private kitchen",
    "kitchenette",
    "keukenblok",
    "keukenblokje",
]
SHARED_KITCHEN_KEYWORDS = [
    "gedeelde keuken",
    "gezamenlijke keuken",
    "shared kitchen",
    "communal kitchen",
]
PRIVATE_BATHROOM_KEYWORDS = [
    "eigen badkamer",
    "badkamer met douche",
    "inloopdouche",
    "douche, toilet en wastafel",
    "private bathroom",
]
SHARED_BATHROOM_KEYWORDS = [
    "gedeelde badkamer",
    "gezamenlijke badkamer",
    "shared bathroom",
    "communal bathroom",
]
PRIVATE_TOILET_KEYWORDS = [
    "eigen toilet",
    "toilet en wastafel",
    "private toilet",
]
SHARED_TOILET_KEYWORDS = [
    "gedeeld toilet",
    "gedeelde toilet",
    "gezamenlijk toilet",
    "shared toilet",
    "communal toilet",
]
SHARED_LAUNDRY_KEYWORDS = [
    "gedeelde wasruimte",
    "gezamenlijke wasruimte",
    "shared laundry",
    "communal laundry",
]
WONINGRUIL_KEYWORDS = [
    "woningruil",
    "huisruil",
    "ruilwoning",
    "ruil appartement",
    "ruilwoning gezocht",
]
SHARED_SIGNALS = [
    "gedeelde",
    "gezamenlijke",
    "gezamenlijk",
    "huisgenoten",
    "studentenhuis",
    "shared",
    "communal",
    "room in shared",
]
INDEPENDENT_SIGNALS = [
    "zelfstandig",
    "zelfstandige",
    "self-contained",
    "self contained",
    "independent",
]
RENTED_SIGNALS = [
    "verhuurd",
    "niet beschikbaar",
    "rented",
    "unavailable",
    "let",
]
UNDER_OPTION_SIGNALS = [
    "onder optie",
    "under option",
]
RESERVED_SIGNALS = [
    "verhuurd onder voorbehoud",
    "gereserveerd",
    "reserved",
    "let agreed",
]
AVAILABLE_SIGNALS = [
    "beschikbaar vanaf",
    "beschikbaar",
    "direct inschrijven",
    "direct beschikbaar",
    "te huur",
    "available",
    "available from",
]
MESSY_TITLE_PATTERNS = [
    r"\b[a-z][a-z0-9_]*\.[a-z0-9_.]+\b",
    r"\b(?:price_condition|price_type|rental_price|object_type|available_from)\b",
    r"\bmeer op onze site\b",
    r"\bte huur:\s*",
    r"\bnieuw!\s*",
    r"\bnieuw\s*:\s*",
    r"\bvraag een bezichtiging aan via de link onderaan deze advertentie!?\b",
    r"\bgevonden voor\s*€\s*[0-9][0-9.,]*\b",
    r"\bappartement gevonden in [^,.]+,\s*nu beschikbaar voor.*$",
    r"\bstudio gevonden in [^,.]+,\s*nu beschikbaar voor.*$",
    r"\b(?:marktplaats|funda|ikwilhuren|mvgm)\s*[-|:]\s*",
]

RAW_METADATA_PATTERNS = [
    r"\b[a-z][a-z0-9_]*\.[a-z0-9_.]+\b",
    r"\b(?:price_condition|price_type|rental_price|object_type|available_from|service_costs|deposit)\b\s*[:=]?\s*",
    r"\b(?:per_month|per month|p/m|pm)\b",
    r"\b(?:null|undefined|none|nan)\b",
]


@dataclass(frozen=True)
class ListingQualityInput:
    title: str
    description: str
    url: str
    requested_city: str
    scraped_city: str | None
    price: int | None
    area_m2: int | None
    image_url: str | None
    source_reliability_weight: float = 0.7


def normalize_space(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


def clean_listing_text(value: str | None) -> str:
    cleaned = normalize_space(value)

    if not cleaned:
        return ""

    cleaned = cleaned.replace("€ ", "€")
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)

    for pattern in RAW_METADATA_PATTERNS:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"(?:^|\s)[|•]{1,2}(?:\s|$)", " ", cleaned)
    cleaned = re.sub(r"\s*[-|:]\s*[-|:]\s*", " - ", cleaned)
    cleaned = normalize_space(cleaned)
    return cleaned.strip(" ,-:|")


def includes_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def phrase_positions(text: str, phrases: list[str]) -> list[int]:
    positions = []

    for phrase in phrases:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        match = re.search(pattern, text)

        if match:
            positions.append(match.start())

    return positions


def clean_listing_title(
    title: str,
    *,
    address_text: str | None = None,
    street_name: str | None = None,
    house_number: str | None = None,
    city: str | None = None,
) -> str:
    cleaned = clean_listing_text(title)

    address_candidate = normalize_space(address_text)
    street_candidate = normalize_space(
        " ".join(part for part in [street_name, house_number] if normalize_space(part))
    )
    city_candidate = normalize_space(city)

    if address_candidate:
        clean_address = clean_listing_text(address_candidate)
        if city_candidate and city_candidate.lower() not in clean_address.lower():
            clean_address = f"{clean_address}, {city_candidate}"
        if len(clean_address) >= 8:
            return clean_address[:96]

    if street_candidate and city_candidate:
        return f"{street_candidate}, {city_candidate}"[:96]

    for pattern in MESSY_TITLE_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip(" ,-:|")

    cut_markers = [
        " Vraag een bezichtiging ",
        " Gelieve ",
        " Deze ",
        " Dit ",
        " Bij binnenkomst ",
        " Gelegen ",
        " Bekijk ",
        " Vanaf ",
    ]
    for marker in cut_markers:
        if marker in cleaned and cleaned.index(marker) > 18:
            cleaned = cleaned.split(marker)[0].strip(" ,-:|")

    cleaned = re.sub(r"\b(.{8,64})\b(?:\s*[-|,]\s*\1\b)+", r"\1", cleaned, flags=re.IGNORECASE)
    return cleaned or clean_listing_text(title)


def build_display_title(
    title: str | None,
    *,
    address_text: str | None = None,
    street_name: str | None = None,
    house_number: str | None = None,
    city: str | None = None,
    property_type: str | None = None,
) -> str:
    cleaned = clean_listing_title(
        title or "",
        address_text=address_text,
        street_name=street_name,
        house_number=house_number,
        city=city,
    )

    if cleaned and len(cleaned) >= 6:
        return cleaned

    property_type_labels = {
        "apartment": "Apartment",
        "house": "House",
        "studio": "Studio",
        "room": "Room",
        "parking": "Parking",
    }
    city_candidate = normalize_space(city)
    type_label = property_type_labels.get(property_type or "")

    if type_label and city_candidate:
        return f"{type_label} in {city_candidate}"

    if city_candidate:
        return city_candidate

    return clean_listing_text(title) or "Rental listing"


def clean_listing_description(description: str | None, title: str | None = None) -> str:
    cleaned = clean_listing_text(description)
    clean_title = clean_listing_title(title or "")

    if not cleaned:
        return ""

    noise_patterns = [
        r"\bmeer op onze site\b",
        r"\bvraag een bezichtiging aan via de link onderaan deze advertentie!?\b",
        r"\bgevonden voor\s*€\s*[0-9][0-9.,]*\b",
        r"\b(?:bekijk|lees)\s+meer\s+op\s+de\s+website\s+van\s+de\s+aanbieder\b",
    ]

    for pattern in noise_patterns:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)

    if clean_title:
        cleaned = re.sub(re.escape(clean_title), " ", cleaned, flags=re.IGNORECASE)

    sentences = re.split(r"(?<=[.!?])\s+", normalize_space(cleaned))
    useful_sentences = []
    seen = set()

    for sentence in sentences:
        sentence = clean_listing_text(sentence)
        if not sentence or len(sentence) < 12:
            continue
        key = sentence.lower()
        if key in seen:
            continue
        seen.add(key)
        useful_sentences.append(sentence)

    return normalize_space(" ".join(useful_sentences) or cleaned)


def clean_listing_summary(
    title: str | None,
    description: str | None,
    *,
    max_length: int = 220,
) -> str:
    cleaned = clean_listing_description(description, title)
    if not cleaned:
        cleaned = clean_listing_title(title or "")

    if len(cleaned) <= max_length:
        return cleaned

    truncated = cleaned[: max_length - 1].rsplit(" ", 1)[0].strip()
    return f"{truncated}..."


def infer_property_type(combined_text: str) -> str:
    # 1. House compound terms win unconditionally — prevents "slaapkamer" triggering "room".
    if _HOUSE_COMPOUND_RE.search(combined_text):
        return "house"

    # 2. Parking / studio / apartment by substring (these don't have problematic compounds).
    for property_type, keywords in PROPERTY_TYPE_KEYWORDS.items():
        if property_type in {"parking", "studio", "apartment", "room"} and includes_any(combined_text, keywords):
            return property_type

    # 3. Generic house words as whole tokens (after studio/apartment have been tried).
    if _HUIS_WONING_RE.search(combined_text):
        return "house"

    # 4. "kamer" as a whole word only — never matches inside slaapkamer / woonkamer.
    if _KAMER_WORD_RE.search(combined_text):
        return "room"

    return "unknown"


def infer_property_subtype(combined_text: str, main_type: str) -> str | None:
    """Return a sub-classification for house and apartment listings."""
    if main_type == "house":
        for subtype, keywords in HOUSE_SUBTYPE_KEYWORDS.items():
            if includes_any(combined_text, keywords):
                return subtype
        return "other_house"
    if main_type == "apartment":
        for subtype, keywords in APARTMENT_SUBTYPE_KEYWORDS.items():
            if includes_any(combined_text, keywords):
                return subtype
        return None
    return None


PRIVATE_ASSUMPTION_TYPES = {"apartment", "house", "studio"}


def infer_private_feature(
    combined_text: str,
    private_keywords: list[str],
    shared_keywords: list[str],
    property_type: str = "unknown",
) -> bool | None:
    # Explicit shared mention overrides everything else
    if includes_any(combined_text, shared_keywords):
        return False

    # Explicit private mention
    if includes_any(combined_text, private_keywords):
        return True

    # For self-contained property types assume private unless broad shared
    # housing signals are present (e.g. "huisgenoten", "studentenhuis").
    if property_type in PRIVATE_ASSUMPTION_TYPES and not includes_any(combined_text, SHARED_SIGNALS):
        return True

    return None


def extract_city_from_text(text: str, requested_city: str) -> str | None:
    normalized_text = normalize_space(text)

    if not normalized_text:
        return None

    candidates = [requested_city, *KNOWN_CITY_NAMES]
    seen = set()

    for city in candidates:
        normalized_city = normalize_space(city)
        key = normalized_city.lower()

        if not normalized_city or key in seen:
            continue

        seen.add(key)
        city_pattern = re.escape(normalized_city).replace(r"\ ", r"\s+")
        patterns = [
            rf"\b(?:in|te|omgeving)\s+{city_pattern}\b",
            rf"\b{city_pattern}\b",
        ]

        if any(re.search(pattern, normalized_text, re.IGNORECASE) for pattern in patterns):
            return normalized_city

    return None


def infer_listing_city(title: str, description: str, requested_city: str, scraped_city: str | None) -> str:
    # Title is short and focused — any city found there is trustworthy.
    title_city = extract_city_from_text(title, requested_city)
    if title_city:
        return title_city

    # scraped_city comes from the scraper directly; requested_city is the scanner's
    # target. Both are more authoritative than an incidental mention in a long
    # description (e.g. "formerly in Breda" on a Rotterdam listing).
    authoritative = normalize_space(scraped_city) or normalize_space(requested_city)
    if authoritative:
        return authoritative

    # Fall back to description only when no other signal exists, and even then
    # only look for the requested_city (not arbitrary cities) to stay conservative.
    if requested_city:
        desc_city = extract_city_from_text(description, requested_city)
        if desc_city == normalize_space(requested_city):
            return desc_city

    return ""


def calculate_confidence_score(
    *,
    title: str,
    city: str,
    property_type: str,
    price: int | None,
    area_m2: int | None,
    image_url: str | None,
    private_kitchen: bool | None,
    private_bathroom: bool | None,
    private_toilet: bool | None,
    is_shared: bool | None,
    is_woningruil: bool,
    availability_status: str,
    source_reliability_weight: float = 0.7,
) -> float:
    score = 0.2

    if price is not None:
        score += 0.18
    if city:
        score += 0.06
    if image_url:
        score += 0.09
    if area_m2 is not None:
        score += 0.12
    if property_type != "unknown":
        score += 0.12
    if any(value is not None for value in [private_kitchen, private_bathroom, private_toilet]):
        score += 0.08
    if is_shared is not None:
        score += 0.06

    cleaned_title = clean_listing_title(title)
    if len(cleaned_title) < 8:
        score -= 0.08
    elif cleaned_title.lower() != clean_listing_text(title).lower():
        score -= 0.03
    if is_woningruil:
        score -= 0.12
    if availability_status in {"rented", "under_option", "reserved"}:
        score -= 0.2
    if property_type == "parking":
        score -= 0.08

    if source_reliability_weight >= 0.85:
        score += 0.04
    elif source_reliability_weight <= 0.4:
        score -= 0.05

    return round(max(0.0, min(score, 1.0)), 2)


def build_listing_quality(data: ListingQualityInput) -> dict:
    combined_text = normalize_space(f"{data.title} {data.description} {data.url}").lower()
    city = infer_listing_city(
        title=data.title,
        description=data.description,
        requested_city=data.requested_city,
        scraped_city=data.scraped_city,
    )
    property_type = infer_property_type(combined_text)
    private_kitchen = infer_private_feature(
        combined_text,
        PRIVATE_KITCHEN_KEYWORDS,
        SHARED_KITCHEN_KEYWORDS,
        property_type=property_type,
    )
    private_bathroom = infer_private_feature(
        combined_text,
        PRIVATE_BATHROOM_KEYWORDS,
        SHARED_BATHROOM_KEYWORDS,
        property_type=property_type,
    )
    private_toilet = infer_private_feature(
        combined_text,
        PRIVATE_TOILET_KEYWORDS,
        SHARED_TOILET_KEYWORDS,
        property_type=property_type,
    )
    shared_laundry = True if includes_any(combined_text, SHARED_LAUNDRY_KEYWORDS) else None
    is_woningruil = includes_any(combined_text, WONINGRUIL_KEYWORDS)
    under_option_positions = phrase_positions(combined_text, UNDER_OPTION_SIGNALS)
    reserved_positions = phrase_positions(combined_text, RESERVED_SIGNALS)
    rented_positions = phrase_positions(combined_text, RENTED_SIGNALS)
    available_positions = phrase_positions(combined_text, AVAILABLE_SIGNALS)

    if reserved_positions and (
        not available_positions or min(reserved_positions) <= min(available_positions)
    ):
        availability_status = "reserved"
        is_available = False
    elif under_option_positions and (
        not available_positions or min(under_option_positions) <= min(available_positions)
    ):
        availability_status = "under_option"
        is_available = False
    elif rented_positions and (
        not available_positions or min(rented_positions) < min(available_positions)
    ):
        availability_status = "rented"
        is_available = False
    elif available_positions:
        availability_status = "available"
        is_available = True
    else:
        availability_status = "unknown"
        is_available = None

    if includes_any(combined_text, SHARED_SIGNALS) or any(
        value is False for value in [private_kitchen, private_bathroom, private_toilet]
    ):
        is_shared = True
    elif (
        property_type in {"studio", "apartment", "house"}
        or includes_any(combined_text, INDEPENDENT_SIGNALS)
        or all(value is True for value in [private_kitchen, private_bathroom])
    ):
        is_shared = False
    else:
        is_shared = None

    confidence_score = calculate_confidence_score(
        title=data.title,
        city=city,
        property_type=property_type,
        price=data.price,
        area_m2=data.area_m2,
        image_url=data.image_url,
        private_kitchen=private_kitchen,
        private_bathroom=private_bathroom,
        private_toilet=private_toilet,
        is_shared=is_shared,
        is_woningruil=is_woningruil,
        availability_status=availability_status,
        source_reliability_weight=data.source_reliability_weight,
    )

    return {
        "city": city,
        "property_type": property_type,
        "private_kitchen": private_kitchen,
        "private_bathroom": private_bathroom,
        "private_toilet": private_toilet,
        "shared_laundry": shared_laundry,
        "is_shared": is_shared,
        "is_woningruil": is_woningruil,
        "availability_status": availability_status,
        "is_available": is_available,
        "confidence_score": confidence_score,
    }

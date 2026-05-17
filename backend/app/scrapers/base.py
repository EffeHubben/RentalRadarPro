from __future__ import annotations

from dataclasses import dataclass, field
import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup


@dataclass
class ScrapedListing:
    title: str
    source: str
    url: str
    city: str | None = None
    price: int | None = None
    area_m2: int | None = None
    rooms: int | None = None
    image_url: str | None = None
    description: str = ""
    availability_status: str = "unknown"
    is_available: bool | None = None
    address_text: str | None = None
    street_name: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    scrape_diagnostics: dict[str, int] = field(default_factory=dict)


UNAVAILABLE_PHRASES = [
    "verhuurd",
    "niet beschikbaar",
    "rented",
    "unavailable",
]
UNDER_OPTION_PHRASES = [
    "onder optie",
    "under option",
]
RESERVED_PHRASES = [
    "verhuurd onder voorbehoud",
    "gereserveerd",
    "reserved",
    "let agreed",
]
AVAILABLE_PHRASES = [
    "beschikbaar vanaf",
    "beschikbaar",
    "direct inschrijven",
    "direct beschikbaar",
    "te huur",
    "available",
    "available from",
]
POSTCODE_CITY_RE = re.compile(
    r"\b(\d{4}\s?[A-Z]{2})\s+([A-ZÀ-ÖØ-Þa-zà-öø-ÿ' -]{2,80}?)(?=(?:\s*[-,]\s*\d+\s*km\.?)|$|[|•])",
    re.IGNORECASE,
)
HOUSE_NUMBER_RE = re.compile(r"^(?P<street>.+?)\s+(?P<number>\d[\w/-]*)$")
BLOCKED_IMAGE_MARKERS = (
    "logo",
    "placeholder",
    "photo_waiting",
    "icon",
    "favicon",
    "spinner",
    "tenant-coin",
    "mapbox",
    "googleapis.com/maps",
    "/maps/",
    "static.nbo.nl",
)


def normalize_space(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


def normalize_postal_code(value: str | None) -> str | None:
    normalized = normalize_space(value).upper().replace(" ", "")

    if not normalized or not re.fullmatch(r"\d{4}[A-Z]{2}", normalized):
        return None

    return f"{normalized[:4]} {normalized[4:]}"


def split_street_and_number(value: str | None) -> tuple[str | None, str | None]:
    normalized = normalize_space(value)

    if not normalized:
        return None, None

    match = HOUSE_NUMBER_RE.match(normalized)

    if not match:
        return normalized, None

    return normalize_space(match.group("street")), normalize_space(match.group("number")).upper()


def parse_postcode_city(text: str | None) -> tuple[str | None, str | None]:
    normalized = normalize_space(text)

    if not normalized:
        return None, None

    match = POSTCODE_CITY_RE.search(normalized)

    if not match:
        return None, None

    postal_code = normalize_postal_code(match.group(1))
    city = normalize_space(match.group(2).strip(" -,"))
    return postal_code, city or None


def phrase_positions(text: str, phrases: list[str]) -> list[int]:
    positions = []

    for phrase in phrases:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        match = re.search(pattern, text)

        if match:
            positions.append(match.start())

    return positions


def detect_availability(text: str) -> tuple[str, bool | None]:
    normalized_text = normalize_space(text).lower()

    reserved_positions = phrase_positions(normalized_text, RESERVED_PHRASES)
    under_option_positions = phrase_positions(normalized_text, UNDER_OPTION_PHRASES)
    unavailable_positions = phrase_positions(normalized_text, UNAVAILABLE_PHRASES)
    available_positions = phrase_positions(normalized_text, AVAILABLE_PHRASES)

    if reserved_positions and (
        not available_positions or min(reserved_positions) <= min(available_positions)
    ):
        return "reserved", False

    if under_option_positions and (
        not available_positions or min(under_option_positions) <= min(available_positions)
    ):
        return "under_option", False

    if unavailable_positions and (
        not available_positions or min(unavailable_positions) < min(available_positions)
    ):
        return "rented", False

    if available_positions:
        return "available", True

    return "unknown", None


def detect_availability_status(text: str) -> tuple[str, bool | None]:
    return detect_availability(text)


def availability_from_schema(value: str | None) -> tuple[str, bool | None]:
    normalized = normalize_space(value).lower()

    if not normalized:
        return "unknown", None

    if "instock" in normalized or "preorder" in normalized:
        return "available", True

    if "limitedavailability" in normalized:
        return "reserved", False

    if any(token in normalized for token in ["soldout", "outofstock", "discontinued"]):
        return "rented", False

    return "unknown", None


def _parse_numeric_amount(raw_value: str) -> int | None:
    value = normalize_space(raw_value)

    if not value:
        return None

    value = value.replace(",-", "").replace(",-", "")
    value = re.sub(r"[^\d,.-]", "", value)

    if not value:
        return None

    if "." in value and "," in value:
        value = value.replace(".", "")
        value = value.split(",", 1)[0]
    elif "," in value:
        before, after = value.rsplit(",", 1)
        if len(after) in {1, 2}:
            value = before
        else:
            value = value.replace(",", "")
    else:
        value = value.replace(".", "")

    value = value.strip("-")

    if not value.isdigit():
        return None

    amount = int(value)

    if amount > 25000 and amount % 100 == 0:
        amount = amount // 100

    if 250 <= amount <= 25000:
        return amount

    return None


def parse_price(value: str | int | float | None) -> int | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        amount = int(round(float(value)))

        if amount > 25000 and amount % 100 == 0:
            amount = amount // 100

        return amount if 250 <= amount <= 25000 else None

    normalized = normalize_space(value)

    if not normalized:
        return None

    euro_matches = re.findall(r"€\s*([0-9][0-9.,\s]*)", normalized)

    for match in euro_matches:
        amount = _parse_numeric_amount(match)
        if amount is not None:
            return amount

    month_matches = re.findall(
        r"\b([0-9][0-9.,\s]{2,})\s*(?:/mnd|per\s+maand|p/m|pm)\b",
        normalized.lower(),
    )
    for match in month_matches:
        amount = _parse_numeric_amount(match)
        if amount is not None:
            return amount

    trailing_euro_matches = re.findall(
        r"\b([0-9][0-9.,\s]{2,})\s*euro(?:\s*/\s*maand|\s+per\s+maand)?\b",
        normalized.lower(),
    )
    for match in trailing_euro_matches:
        amount = _parse_numeric_amount(match)
        if amount is not None:
            return amount

    return None


def extract_price_from_text(text: str) -> int | None:
    return parse_price(text)


def parse_area_m2(value: str | int | float | None) -> int | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        area = int(round(float(value)))
        return area if 5 <= area <= 500 else None

    normalized = normalize_space(value).lower()

    if not normalized:
        return None

    range_match = re.search(
        r"\b(\d{1,3})\s*(?:tot|-|–|to)\s*(\d{1,3})\s*(?:m²|m\s*2|m2|sqm|sq m|vierkante meter)\b",
        normalized,
    )
    if range_match:
        area = max(int(range_match.group(1)), int(range_match.group(2)))
        return area if 5 <= area <= 500 else None

    match = re.search(
        r"\b(\d{1,3})(?:[.,]\d+)?\s*(?:m²|m\s*2|m2|sqm|sq m|vierkante meter)\b",
        normalized,
    )
    if match:
        area = int(match.group(1))
        return area if 5 <= area <= 500 else None

    match = re.search(
        r"\b(?:woonoppervlakte|oppervlakte|floor area)\s*[:\-]?\s*(\d{1,3})\b",
        normalized,
    )
    if match:
        area = int(match.group(1))
        return area if 5 <= area <= 500 else None

    return None


def extract_area_from_text(text: str) -> int | None:
    return parse_area_m2(text)


def parse_rooms(value: str | int | None) -> int | None:
    if value is None:
        return None

    if isinstance(value, int):
        return value if 1 <= value <= 20 else None

    normalized = normalize_space(value).lower()

    if not normalized:
        return None

    match = re.search(r"\b(\d{1,2})\s*(?:kamer(?:s)?|room(?:s)?)(?![a-z])", normalized)
    if not match:
        match = re.search(r"\b(?:kamer(?:s)?|room(?:s)?)\s*[:\-]?\s*(\d{1,2})\b", normalized)

    if not match:
        return None

    rooms = int(match.group(1))
    return rooms if 1 <= rooms <= 20 else None


def parse_bedrooms(value: str | int | None) -> int | None:
    if value is None:
        return None

    if isinstance(value, int):
        return value if 1 <= value <= 20 else None

    normalized = normalize_space(value).lower()

    if not normalized:
        return None

    match = re.search(r"\b(\d{1,2})\s*(?:slaapkamer(?:s)?|bedroom(?:s)?)(?![a-z])", normalized)
    if not match:
        match = re.search(
            r"\b(?:slaapkamer(?:s)?|bedroom(?:s)?)\s*[:\-]?\s*(\d{1,2})\b",
            normalized,
        )

    if not match:
        return None

    bedrooms = int(match.group(1))
    return bedrooms if 1 <= bedrooms <= 20 else None


def parse_room_count(value: str | int | None) -> int | None:
    return parse_rooms(value) or parse_bedrooms(value)


def extract_rooms_from_text(text: str) -> int | None:
    return parse_room_count(text)


def clean_image_url(url: str | None, base_url: str | None = None) -> str | None:
    raw_url = normalize_space(url)

    if not raw_url:
        return None

    if raw_url.startswith("//"):
        raw_url = f"https:{raw_url}"
    elif base_url:
        raw_url = urljoin(base_url, raw_url)

    parsed = urlparse(raw_url)

    if parsed.scheme not in {"http", "https"}:
        return None

    return raw_url


def is_listing_photo_url(url: str | None) -> bool:
    cleaned_url = clean_image_url(url)

    if not cleaned_url:
        return False

    lowered = cleaned_url.lower()

    if lowered.endswith(".svg") or "data:image/svg" in lowered:
        return False

    return not any(marker in lowered for marker in BLOCKED_IMAGE_MARKERS)


def extract_url_from_srcset(value: str | None) -> str | None:
    srcset = normalize_space(value)

    if not srcset:
        return None

    first_candidate = srcset.split(",", 1)[0].strip()
    return first_candidate.split(" ", 1)[0].strip()


def image_url_from_tag(tag, base_url: str) -> str | None:
    candidates = (
        tag.get("src"),
        tag.get("data-src"),
        tag.get("data-lazy"),
        tag.get("data-original"),
        extract_url_from_srcset(tag.get("srcset")),
        extract_url_from_srcset(tag.get("data-srcset")),
    )
    for candidate in candidates:
        cleaned = clean_image_url(candidate, base_url)
        if cleaned and is_listing_photo_url(cleaned):
            return cleaned
    return None


def image_url_from_style(style: str | None, base_url: str) -> str | None:
    value = normalize_space(style)

    if not value:
        return None

    match = re.search(r"url\((['\"]?)(.*?)\1\)", value, re.IGNORECASE)

    if not match:
        return None

    cleaned = clean_image_url(match.group(2), base_url)
    return cleaned if is_listing_photo_url(cleaned) else None


def extract_json_ld_objects(soup: BeautifulSoup) -> list[dict]:
    objects: list[dict] = []

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw_content = script.string or script.get_text(strip=True)

        if not raw_content:
            continue

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            continue

        if isinstance(parsed, list):
            objects.extend(item for item in parsed if isinstance(item, dict))
        elif isinstance(parsed, dict):
            objects.append(parsed)

    return objects


def _collect_json_ld_image_candidates(value, base_url: str, candidates: list[str]) -> None:
    if isinstance(value, str):
        cleaned = clean_image_url(value, base_url)
        if cleaned:
            candidates.append(cleaned)
        return

    if isinstance(value, list):
        for item in value:
            _collect_json_ld_image_candidates(item, base_url, candidates)
        return

    if isinstance(value, dict):
        for key in ("image", "contentUrl", "url"):
            if key in value:
                _collect_json_ld_image_candidates(value[key], base_url, candidates)


def extract_listing_image(soup: BeautifulSoup, base_url: str, *, element=None) -> str | None:
    candidates: list[str] = []

    if element is not None:
        current = element
        for _ in range(8):
            if current is None:
                break

            if hasattr(current, "find_all"):
                for image in current.find_all("img"):
                    candidate = image_url_from_tag(image, base_url)
                    if candidate:
                        candidates.append(candidate)

                for styled in current.find_all(style=True):
                    candidate = image_url_from_style(styled.get("style"), base_url)
                    if candidate:
                        candidates.append(candidate)

            current = current.parent

    for meta in (
        soup.find("meta", attrs={"property": "og:image"}),
        soup.find("meta", attrs={"name": "twitter:image"}),
    ):
        if meta:
            candidate = clean_image_url(meta.get("content"), base_url)
            if candidate:
                candidates.append(candidate)

    for item in extract_json_ld_objects(soup):
        _collect_json_ld_image_candidates(item.get("image"), base_url, candidates)
        _collect_json_ld_image_candidates(item.get("primaryImageOfPage"), base_url, candidates)

    for image in soup.find_all("img"):
        candidate = image_url_from_tag(image, base_url)
        if candidate:
            candidates.append(candidate)

    for styled in soup.find_all(style=True):
        candidate = image_url_from_style(styled.get("style"), base_url)
        if candidate:
            candidates.append(candidate)

    for candidate in candidates:
        if is_listing_photo_url(candidate):
            return candidate

    return None

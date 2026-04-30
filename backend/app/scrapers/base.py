from dataclasses import dataclass
import re


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


UNAVAILABLE_PHRASES = [
    "verhuurd onder voorbehoud",
    "verhuurd",
    "niet beschikbaar",
    "gereserveerd",
    "reserved",
    "rented",
    "unavailable",
]
UNDER_OPTION_PHRASES = [
    "onder optie",
    "under option",
]
AVAILABLE_PHRASES = [
    "beschikbaar vanaf",
    "direct inschrijven",
    "direct beschikbaar",
    "te huur",
    "available from",
]


def detect_availability_status(text: str) -> tuple[str, bool | None]:
    normalized_text = (text or "").lower()
    def phrase_positions(phrases: list[str]) -> list[int]:
        positions = []

        for phrase in phrases:
            pattern = r"\b" + re.escape(phrase) + r"\b"
            match = re.search(pattern, normalized_text)

            if match:
                positions.append(match.start())

        return positions

    under_option_positions = phrase_positions(UNDER_OPTION_PHRASES)
    unavailable_positions = phrase_positions(UNAVAILABLE_PHRASES)
    available_positions = phrase_positions(AVAILABLE_PHRASES)

    if under_option_positions:
        return "under_option", False

    if unavailable_positions and (
        not available_positions or min(unavailable_positions) < min(available_positions)
    ):
        return "rented", False

    if available_positions:
        return "available", True

    return "unknown", None


def extract_price_from_text(text: str) -> int | None:
    if not text:
        return None

    normalized_text = text.replace("\xa0", " ")

    matches = re.findall(r"€\s*([0-9][0-9\.\,]*)", normalized_text)

    for match in matches:
        value = match.strip()

        if "," in value:
            value = value.split(",")[0]

        value = value.replace(".", "")

        try:
            price = int(value)
        except ValueError:
            continue

        if 300 <= price <= 5000:
            return price

    return None


def extract_area_from_text(text: str) -> int | None:
    if not text:
        return None

    normalized_text = text.replace("\xa0", " ")

    match = re.search(r"(\d+)\s*m²", normalized_text)

    if not match:
        match = re.search(r"(\d+)\s*m2", normalized_text.lower())

    if not match:
        return None

    try:
        area = int(match.group(1))
    except ValueError:
        return None

    if 5 <= area <= 300:
        return area

    return None


def extract_rooms_from_text(text: str) -> int | None:
    if not text:
        return None

    normalized_text = text.lower().replace("\xa0", " ")

    match = re.search(r"(\d+)\s*kamer", normalized_text)

    if not match:
        return None

    try:
        rooms = int(match.group(1))
    except ValueError:
        return None

    if 1 <= rooms <= 20:
        return rooms

    return None

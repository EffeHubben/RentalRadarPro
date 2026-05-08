from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
import re
from typing import Any
from urllib.parse import parse_qsl, unquote, urlparse

from app.models.listing import Listing
from app.services.location import city_coordinates, extract_address_parts, normalize_space, slug_to_text


KNOWN_CITY_TITLECASE: dict[str, str] = {
    "amsterdam": "Amsterdam",
    "rotterdam": "Rotterdam",
    "den haag": "Den Haag",
    "the hague": "Den Haag",
    "utrecht": "Utrecht",
    "eindhoven": "Eindhoven",
    "tilburg": "Tilburg",
    "breda": "Breda",
    "den bosch": "Den Bosch",
    "'s-hertogenbosch": "Den Bosch",
    "s-hertogenbosch": "Den Bosch",
    "nijmegen": "Nijmegen",
    "arnhem": "Arnhem",
    "groningen": "Groningen",
    "maastricht": "Maastricht",
    "leiden": "Leiden",
    "delft": "Delft",
    "haarlem": "Haarlem",
    "almere": "Almere",
    "amersfoort": "Amersfoort",
    "apeldoorn": "Apeldoorn",
    "enschede": "Enschede",
    "zwolle": "Zwolle",
    "dordrecht": "Dordrecht",
    "zoetermeer": "Zoetermeer",
    "etten-leur": "Etten-Leur",
    "roosendaal": "Roosendaal",
    "bergen op zoom": "Bergen op Zoom",
    "oosterhout": "Oosterhout",
    "prinsenbeek": "Prinsenbeek",
    "ede": "Ede",
    "leeuwarden": "Leeuwarden",
    "deventer": "Deventer",
    "helmond": "Helmond",
    "alkmaar": "Alkmaar",
    "venlo": "Venlo",
    "gouda": "Gouda",
    "oss": "Oss",
    "drachten": "Drachten",
    "veldhoven": "Veldhoven",
    "waalwijk": "Waalwijk",
    "gorinchem": "Gorinchem",
    "made": "Made",
    "terheijden": "Terheijden",
    "rijen": "Rijen",
    "zevenbergen": "Zevenbergen",
}
CITY_PATTERNS = sorted(KNOWN_CITY_TITLECASE, key=len, reverse=True)
PRECISIONAL_LOCATION_PRECISIONS = {"exact_address", "street", "postcode"}
LOW_PRECISION_LOCATION_PRECISIONS = {"city", "unknown", ""}
CITY_CENTER_TOLERANCE = 0.0002
REPAIR_ACTIONS_WITH_WRITES = {"repair_location", "clear_coordinates", "clear_city_and_coordinates"}


@dataclass(frozen=True)
class RepairSignal:
    source: str
    city: str


@dataclass
class RepairPlan:
    action: str
    reason: str
    target_city: str | None = None
    updates: dict[str, Any] = field(default_factory=dict)
    signals: list[RepairSignal] = field(default_factory=list)

    @property
    def writes(self) -> bool:
        return bool(self.updates)


def canonical_city(value: str | None) -> str | None:
    normalized = normalize_space(value).lower()
    if not normalized:
        return None
    return KNOWN_CITY_TITLECASE.get(normalized)


def normalize_location_precision(value: str | None) -> str:
    normalized = normalize_space(value).lower()
    return normalized or "unknown"


def city_only_address_city(address_text: str | None) -> str | None:
    normalized = normalize_space(address_text)
    if not normalized:
        return None

    match = re.fullmatch(r"(.+?),\s*Nederland", normalized, flags=re.IGNORECASE)
    if not match:
        return None

    return canonical_city(match.group(1))


def is_city_only_address(address_text: str | None, city: str | None) -> bool:
    if not city:
        return False
    expected = f"{city}, Nederland"
    return normalize_space(address_text).lower() == expected.lower()


def synthetic_city_address(city: str) -> str:
    return f"{city}, Nederland"


def collect_cities_from_text(text: str | None) -> list[str]:
    normalized = normalize_space(text)
    if not normalized:
        return []

    lowered = normalized.lower()
    found: list[str] = []
    seen: set[str] = set()
    for alias in CITY_PATTERNS:
        pattern = rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])"
        if re.search(pattern, lowered, flags=re.IGNORECASE):
            canonical = KNOWN_CITY_TITLECASE[alias]
            if canonical not in seen:
                seen.add(canonical)
                found.append(canonical)
    return found


def infer_city_from_title(title: str | None) -> str | None:
    cities = collect_cities_from_text(title)
    if len(cities) == 1:
        return cities[0]
    return None


def infer_city_from_url(url: str | None) -> str | None:
    raw_url = normalize_space(url)
    if not raw_url:
        return None

    parsed = urlparse(raw_url)
    candidates: list[str] = []

    for segment in parsed.path.split("/"):
        segment_text = slug_to_text(unquote(segment))
        candidates.extend(collect_cities_from_text(segment_text))

    for key, value in parse_qsl(parsed.query, keep_blank_values=False):
        normalized_key = normalize_space(key).lower()
        if normalized_key in {"city", "plaats", "location", "search", "q", "query"} or normalized_key.endswith("city"):
            candidates.extend(collect_cities_from_text(unquote(value)))

    unique = list(dict.fromkeys(candidates))
    if len(unique) == 1:
        return unique[0]
    return None


def infer_city_from_precise_address(listing: Listing) -> str | None:
    precision = normalize_location_precision(getattr(listing, "location_precision", None))
    if (
        precision not in PRECISIONAL_LOCATION_PRECISIONS
        and not normalize_space(getattr(listing, "street_name", None))
        and not normalize_space(getattr(listing, "postal_code", None))
    ):
        return None

    parts = extract_address_parts(listing.address_text or "", None)
    return canonical_city(parts.city)


def infer_coordinate_city(latitude: float | None, longitude: float | None) -> str | None:
    if latitude is None or longitude is None:
        return None

    for city in dict.fromkeys(KNOWN_CITY_TITLECASE.values()):
        coords = city_coordinates(city)
        if not coords:
            continue
        lat, lon = coords
        if abs(latitude - lat) <= CITY_CENTER_TOLERANCE and abs(longitude - lon) <= CITY_CENTER_TOLERANCE:
            return city
    return None


def should_keep_existing_coordinates(listing: Listing, target_city: str, coordinate_city: str | None) -> bool:
    precision = normalize_location_precision(getattr(listing, "location_precision", None))
    if precision not in PRECISIONAL_LOCATION_PRECISIONS:
        return False
    if listing.latitude is None or listing.longitude is None:
        return False
    return coordinate_city is None or coordinate_city == target_city


def collect_repair_signals(listing: Listing) -> list[RepairSignal]:
    signals: list[RepairSignal] = []
    precise_address_city = infer_city_from_precise_address(listing)
    if precise_address_city:
        signals.append(RepairSignal(source="address", city=precise_address_city))

    url_city = infer_city_from_url(listing.url)
    if url_city:
        signals.append(RepairSignal(source="url", city=url_city))

    title_city = infer_city_from_title(listing.title)
    if title_city:
        signals.append(RepairSignal(source="title", city=title_city))

    return signals


def infer_reliable_target_city(signals: list[RepairSignal]) -> tuple[str | None, str]:
    if not signals:
        return None, "no_signals"

    strong = [signal for signal in signals if signal.source in {"address", "url"}]
    strong_cities = {signal.city for signal in strong}

    if strong:
        if len(strong_cities) != 1:
            return None, "conflicting_authoritative_signals"
        candidate = next(iter(strong_cities))
        conflicts = [signal for signal in signals if signal.city != candidate]
        if conflicts:
            return None, "conflicting_signals"
        return candidate, "+".join(signal.source for signal in strong)

    counts = Counter(signal.city for signal in signals)
    city, count = counts.most_common(1)[0]
    if count >= 2 and len(counts) == 1:
        return city, "multiple_signals"

    return None, "insufficient_consensus"


def build_city_level_updates(listing: Listing, target_city: str) -> dict[str, Any]:
    updates: dict[str, Any] = {"city": target_city}

    coordinate_city = infer_coordinate_city(listing.latitude, listing.longitude)
    if should_keep_existing_coordinates(listing, target_city, coordinate_city):
        return updates

    coords = city_coordinates(target_city)
    if coords:
        updates["latitude"] = coords[0]
        updates["longitude"] = coords[1]
        updates["location_precision"] = "city"
        updates["location_confidence"] = 0.35
    else:
        updates["latitude"] = None
        updates["longitude"] = None
        updates["location_precision"] = "unknown"
        updates["location_confidence"] = 0.0

    if is_city_only_address(listing.address_text, canonical_city(listing.city) or city_only_address_city(listing.address_text)):
        updates["address_text"] = synthetic_city_address(target_city)
    elif not normalize_space(listing.address_text):
        updates["address_text"] = synthetic_city_address(target_city)

    return updates


def build_coordinate_clear_updates(listing: Listing, *, clear_city: bool) -> dict[str, Any]:
    updates: dict[str, Any] = {
        "latitude": None,
        "longitude": None,
        "location_precision": "unknown",
        "location_confidence": 0.0,
    }

    if clear_city:
        updates["city"] = None

    current_city = canonical_city(listing.city)
    if clear_city and is_city_only_address(
        listing.address_text,
        current_city or city_only_address_city(listing.address_text),
    ):
        updates["address_text"] = None

    return updates


def filter_changed_fields(listing: Listing, updates: dict[str, Any]) -> dict[str, Any]:
    return {
        field: value
        for field, value in updates.items()
        if getattr(listing, field) != value
    }


def plan_listing_location_repair(listing: Listing) -> RepairPlan:
    current_city = canonical_city(listing.city)
    address_city = city_only_address_city(listing.address_text)
    coordinate_city = infer_coordinate_city(listing.latitude, listing.longitude)
    precision = normalize_location_precision(listing.location_precision)
    signals = collect_repair_signals(listing)
    reliable_target, target_reason = infer_reliable_target_city(signals)

    if reliable_target:
        updates = filter_changed_fields(listing, build_city_level_updates(listing, reliable_target))
        if updates:
            return RepairPlan(
                action="repair_location",
                reason=f"target={reliable_target} via {target_reason}",
                target_city=reliable_target,
                updates=updates,
                signals=signals,
            )
        return RepairPlan(
            action="noop",
            reason=f"already_consistent:{reliable_target}",
            target_city=reliable_target,
            signals=signals,
        )

    weak_conflicts = [signal for signal in signals if signal.city != current_city]
    low_precision = precision in LOW_PRECISION_LOCATION_PRECISIONS

    if (
        coordinate_city
        and current_city
        and coordinate_city != current_city
        and low_precision
    ):
        updates = filter_changed_fields(listing, build_coordinate_clear_updates(listing, clear_city=False))
        return RepairPlan(
            action="clear_coordinates",
            reason=f"city/coords mismatch: city={current_city}, coords={coordinate_city}",
            updates=updates,
            signals=signals,
        )

    if (
        coordinate_city == "Breda"
        and current_city == "Breda"
        and low_precision
        and weak_conflicts
        and (address_city in {None, "Breda"})
    ):
        updates = filter_changed_fields(listing, build_coordinate_clear_updates(listing, clear_city=True))
        return RepairPlan(
            action="clear_city_and_coordinates",
            reason="breda fallback without reliable replacement",
            updates=updates,
            signals=signals,
        )

    if coordinate_city == "Breda" and low_precision and weak_conflicts:
        return RepairPlan(
            action="report_only",
            reason="suspicious breda fallback without safe rewrite",
            signals=signals,
        )

    return RepairPlan(action="noop", reason=target_reason, signals=signals)


def apply_repair_plan(listing: Listing, plan: RepairPlan) -> bool:
    if not plan.updates:
        return False

    for field, value in plan.updates.items():
        setattr(listing, field, value)
    return True

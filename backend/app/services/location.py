from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
import re
import time

import requests
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.models.geocode import GeocodeCache, GeocodeFailure


LOCATION_PRECISIONS = {"exact_address", "street", "postcode", "city", "unknown"}
GEOCODE_USER_AGENT = "RentScout/0.1 local development contact@example.com"
GEOCODE_TIMEOUT_SECONDS = 8
GEOCODE_MIN_INTERVAL_SECONDS = 1.0
MAX_EXTERNAL_GEOCODES_PER_RUN = 5
_last_geocode_at = 0.0
_external_geocodes_this_run = 0
_failed_geocode_queries: set[str] = set()


CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "amsterdam": (52.3676, 4.9041),
    "rotterdam": (51.9244, 4.4777),
    "den haag": (52.0705, 4.3007),
    "the hague": (52.0705, 4.3007),
    "utrecht": (52.0907, 5.1214),
    "den bosch": (51.6978, 5.3037),
    "'s-hertogenbosch": (51.6978, 5.3037),
    "eindhoven": (51.4416, 5.4697),
    "groningen": (53.2194, 6.5665),
    "tilburg": (51.5555, 5.0913),
    "breda": (51.5719, 4.7683),
    "nijmegen": (51.8126, 5.8372),
    "arnhem": (51.9851, 5.8987),
    "maastricht": (50.8514, 5.691),
    "haarlem": (52.3874, 4.6462),
    "leiden": (52.1601, 4.497),
    "delft": (52.0116, 4.3571),
    "almere": (52.3508, 5.2647),
    "amersfoort": (52.1561, 5.3878),
    "apeldoorn": (52.2112, 5.9699),
    "enschede": (52.2215, 6.8937),
    "zwolle": (52.5168, 6.083),
    "dordrecht": (51.8133, 4.6901),
    "zoetermeer": (52.0552, 4.4941),
    "prinsenbeek": (51.5987, 4.7126),
    "terheijden": (51.6439, 4.7534),
    "etten-leur": (51.5706, 4.6367),
    "oosterhout": (51.645, 4.8597),
    "roosendaal": (51.5308, 4.4653),
    "bergen op zoom": (51.4946, 4.2872),
    "made": (51.6763, 4.7933),
}


STREET_SUFFIXES = (
    "straat",
    "weg",
    "laan",
    "plein",
    "singel",
    "dreef",
    "kade",
    "markt",
    "hof",
    "pad",
    "steeg",
    "boulevard",
    "plantsoen",
    "veld",
    "velden",
    "dijk",
    "gracht",
    "park",
    "ring",
)


@dataclass(frozen=True)
class AddressParts:
    address_text: str | None = None
    street_name: str | None = None
    house_number: str | None = None
    postal_code: str | None = None
    city: str | None = None
    location_precision: str = "unknown"
    location_confidence: float = 0.0


@dataclass(frozen=True)
class GeocodeAttemptResult:
    query: str
    provider: str
    success: bool
    latitude: float | None = None
    longitude: float | None = None
    precision: str = "unknown"
    confidence: float = 0.0
    matched_label: str | None = None
    error: str | None = None


def reset_geocode_run_budget() -> None:
    global _external_geocodes_this_run, _failed_geocode_queries
    _external_geocodes_this_run = 0
    _failed_geocode_queries = set()


def normalize_space(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


def normalize_postal_code(value: str | None) -> str | None:
    if not value:
        return None

    normalized = value.upper().replace(" ", "")

    if not re.fullmatch(r"\d{4}[A-Z]{2}", normalized):
        return None

    return f"{normalized[:4]} {normalized[4:]}"


def slug_to_text(url: str | None) -> str:
    if not url:
        return ""

    slug = url.rstrip("/").split("/")[-1]
    return re.sub(r"[-_]+", " ", slug)


def known_city_in_text(text: str, requested_city: str | None) -> str | None:
    candidates = [requested_city or "", *CITY_COORDINATES.keys()]
    normalized_text = normalize_space(text).lower()

    for candidate in candidates:
        city = normalize_space(candidate)

        if city and re.search(rf"\b{re.escape(city.lower())}\b", normalized_text):
            return normalize_city_name(city)

    return normalize_city_name(requested_city) if requested_city else None


def normalize_city_name(city: str | None) -> str | None:
    normalized = normalize_space(city)

    if not normalized:
        return None

    aliases = {
        "den bosch": "Den Bosch",
        "'s-hertogenbosch": "'s-Hertogenbosch",
        "etten-leur": "Etten-Leur",
        "bergen op zoom": "Bergen op Zoom",
    }
    key = normalized.lower()

    return aliases.get(key, "-".join(part.capitalize() for part in normalized.split("-")))


def extract_street_and_number(text: str) -> tuple[str | None, str | None]:
    suffix_pattern = "|".join(re.escape(suffix) for suffix in STREET_SUFFIXES)
    pattern = re.compile(
        rf"\b([A-ZÀ-ÖØ-Þa-zà-öø-ÿ][\wÀ-ÖØ-öø-ÿ'.-]*(?:\s+[A-ZÀ-ÖØ-Þa-zà-öø-ÿ][\wÀ-ÖØ-öø-ÿ'.-]*){{0,4}}(?:{suffix_pattern}))\s+(\d{{1,5}}\s?[A-Za-z]?(?:-\d{{1,5}}\s?[A-Za-z]?)?)\b",
        re.IGNORECASE,
    )
    match = pattern.search(text)

    if not match:
        fallback_pattern = re.compile(
            r"\b([A-ZÀ-ÖØ-Þa-zà-öø-ÿ][\wÀ-ÖØ-öø-ÿ'.-]*(?:\s+[A-ZÀ-ÖØ-Þa-zà-öø-ÿ][\wÀ-ÖØ-öø-ÿ'.-]*){0,3})\s+(\d{1,5}\s?[A-Za-z]?(?:-\d{1,5}\s?[A-Za-z]?)?)\s+\d{4}\s?[A-Z]{2}\b",
            re.IGNORECASE,
        )
        match = fallback_pattern.search(text)

    if not match:
        return None, None

    street_name = clean_street_name(match.group(1))
    house_number = normalize_space(match.group(2)).upper().replace(" ", "")
    return street_name, house_number


def clean_street_name(value: str) -> str:
    cleaned = normalize_space(value).title()
    leading_noise = {
        "Appartement",
        "Studio",
        "Eengezinswoning",
        "Woning",
        "Huurwoning",
        "Verhuurd",
        "Onder",
        "Voorbehoud",
        "Centrum",
        "Blikvanger",
        "Nieuwbouw",
    }
    words = cleaned.split()

    while len(words) > 1 and words[0] in leading_noise:
        words = words[1:]

    return " ".join(words)


def extract_address_parts(text: str, requested_city: str | None = None) -> AddressParts:
    normalized_text = normalize_space(text)

    if not normalized_text:
        city = normalize_city_name(requested_city)
        return AddressParts(
            city=city or None,
            address_text=f"{city}, Nederland" if city else None,
            location_precision="city" if city else "unknown",
            location_confidence=0.35 if city else 0.0,
        )

    street_name, house_number = extract_street_and_number(normalized_text)
    local_text = normalized_text

    if street_name and house_number:
        street_tokens = street_name.split()
        street_tail = street_tokens[-1] if street_tokens else street_name
        nearby_match = re.search(
            rf"\b{re.escape(street_tail)}\s+{re.escape(house_number)}\b",
            normalized_text,
            flags=re.IGNORECASE,
        )
        if nearby_match:
            start = max(0, nearby_match.start() - 120)
            end = min(len(normalized_text), nearby_match.end() + 160)
            local_text = normalized_text[start:end]

    postal_match = re.search(r"\b(\d{4}\s?[A-Z]{2})\b", local_text, flags=re.IGNORECASE)
    if not postal_match:
        postal_match = re.search(r"\b(\d{4}\s?[A-Z]{2})\b", normalized_text, flags=re.IGNORECASE)
    postal_code = normalize_postal_code(postal_match.group(1) if postal_match else None)
    city = known_city_in_text(normalized_text, requested_city)

    if street_name and house_number and (postal_code or city):
        parts = [street_name, house_number]
        if postal_code:
            parts.append(postal_code)
        if city:
            parts.append(city)
        return AddressParts(
            address_text=build_address_text(
                AddressParts(
                    street_name=street_name,
                    house_number=house_number,
                    postal_code=postal_code,
                    city=city,
                )
            ),
            street_name=street_name,
            house_number=house_number,
            postal_code=postal_code,
            city=city,
            location_precision="exact_address",
            location_confidence=0.92 if postal_code else 0.82,
        )

    if street_name and city:
        return AddressParts(
            address_text=f"{street_name}, {city}, Nederland",
            street_name=street_name,
            city=city,
            location_precision="street",
            location_confidence=0.66,
        )

    if postal_code and city:
        return AddressParts(
            address_text=f"{postal_code} {city}, Nederland",
            postal_code=postal_code,
            city=city,
            location_precision="postcode",
            location_confidence=0.72,
        )

    if city:
        return AddressParts(
            address_text=f"{city}, Nederland",
            city=city,
            location_precision="city",
            location_confidence=0.35,
        )

    return AddressParts()


def build_address_text(parts: AddressParts) -> str | None:
    pieces = []

    if parts.street_name:
        street = parts.street_name
        if parts.house_number:
            street = f"{street} {parts.house_number}"
        pieces.append(street)

    if parts.postal_code and parts.city:
        pieces.append(f"{parts.postal_code} {parts.city}")
    else:
        if parts.postal_code:
            pieces.append(parts.postal_code)
        if parts.city:
            pieces.append(parts.city)

    if not pieces:
        return None

    return f"{', '.join(pieces)}, Nederland"


def merge_address_parts(primary: AddressParts, fallback: AddressParts) -> AddressParts:
    return AddressParts(
        address_text=primary.address_text or fallback.address_text,
        street_name=primary.street_name or fallback.street_name,
        house_number=primary.house_number or fallback.house_number,
        postal_code=primary.postal_code or fallback.postal_code,
        city=primary.city or fallback.city,
        location_precision=(
            primary.location_precision
            if primary.location_precision != "unknown"
            else fallback.location_precision
        ),
        location_confidence=max(primary.location_confidence, fallback.location_confidence),
    )


def cache_key(query: str) -> str:
    return normalize_space(query).lower()


def is_failed_cached(database: Session, query: str, provider: str) -> bool:
    normalized_query = cache_key(f"{provider}:{query}")

    if normalized_query in _failed_geocode_queries:
        return True

    failure = database.query(GeocodeFailure).filter(GeocodeFailure.query == normalized_query).first()

    if not failure:
        return False

    return not is_transient_geocode_error(failure.error)


def is_transient_geocode_error(error: str | None) -> bool:
    if not error:
        return False

    normalized = error.lower()
    transient_markers = (
        "failed to resolve",
        "name or service not known",
        "max retries exceeded",
        "connection",
        "timeout",
        "temporarily unavailable",
    )

    return any(marker in normalized for marker in transient_markers)


def remember_failed_query(
    database: Session,
    query: str,
    provider: str,
    error: str | None = None,
) -> None:
    if is_transient_geocode_error(error):
        return

    normalized_query = cache_key(f"{provider}:{query}")
    _failed_geocode_queries.add(normalized_query)

    if database.query(GeocodeFailure).filter(GeocodeFailure.query == normalized_query).first():
        return

    database.add(
        GeocodeFailure(
            query=normalized_query,
            provider=provider,
            error=error,
            created_at=datetime.utcnow(),
        )
    )
    database.flush()


def cached_success(database: Session, query: str) -> dict | None:
    normalized_query = cache_key(query)
    cached = database.query(GeocodeCache).filter(GeocodeCache.query == normalized_query).first()

    if not cached:
        return None

    result = {
        "latitude": cached.latitude,
        "longitude": cached.longitude,
        "location_precision": cached.precision,
        "location_confidence": cached.confidence,
    }
    matched_address = address_text_from_matched_label(cached.matched_label)

    if matched_address:
        result["address_text"] = matched_address

    return result


def store_success(
    database: Session,
    query: str,
    result: GeocodeAttemptResult,
) -> None:
    normalized_query = cache_key(query)

    if database.query(GeocodeCache).filter(GeocodeCache.query == normalized_query).first():
        return

    database.add(
        GeocodeCache(
            query=normalized_query,
            latitude=result.latitude,
            longitude=result.longitude,
            precision=result.precision,
            confidence=result.confidence,
            provider=result.provider,
            matched_label=result.matched_label,
            created_at=datetime.utcnow(),
        )
    )
    database.flush()


def address_text_from_matched_label(value: str | None) -> str | None:
    label = normalize_space(value)

    if not label:
        return None

    label = re.sub(
        r"\b(\d{4})([A-Z]{2})\b",
        lambda match: f"{match.group(1)} {match.group(2)}",
        label,
        flags=re.IGNORECASE,
    )

    return f"{label}, Nederland"


def wait_for_geocode_slot() -> bool:
    global _last_geocode_at, _external_geocodes_this_run

    if _external_geocodes_this_run >= MAX_EXTERNAL_GEOCODES_PER_RUN:
        return False

    elapsed = time.monotonic() - _last_geocode_at
    if elapsed < GEOCODE_MIN_INTERVAL_SECONDS:
        time.sleep(GEOCODE_MIN_INTERVAL_SECONDS - elapsed)

    return True


def mark_geocode_request_used() -> None:
    global _last_geocode_at, _external_geocodes_this_run
    _last_geocode_at = time.monotonic()
    _external_geocodes_this_run += 1


def pdok_precision(result_type: str | None) -> tuple[str, float]:
    normalized = (result_type or "").lower()

    if normalized in {"adres", "nummeraanduiding", "verblijfsobject", "ligplaats", "standplaats"}:
        return "exact_address", 0.95

    if normalized in {"weg", "straat"}:
        return "street", 0.72

    if "postcode" in normalized:
        return "postcode", 0.76

    if normalized in {"woonplaats", "gemeente"}:
        return "city", 0.45

    return "unknown", 0.4


def parse_pdok_point(value: str | None) -> tuple[float, float] | None:
    if not value:
        return None

    match = re.search(r"POINT\(([-0-9.]+)\s+([-0-9.]+)\)", value)

    if not match:
        return None

    try:
        longitude = float(match.group(1))
        latitude = float(match.group(2))
    except ValueError:
        return None

    return latitude, longitude


def expected_house_number_from_query(query: str) -> str | None:
    without_postcode = re.sub(r"\b\d{4}\s?[A-Z]{2}\b", " ", query, flags=re.IGNORECASE)
    match = re.search(r"\b(\d{1,5}\s?[A-Za-z]?)\b", without_postcode)

    if not match:
        return None

    return normalize_space(match.group(1)).upper().replace(" ", "")


def pdok_result_score(doc: dict, query: str) -> int:
    result_type = (doc.get("type") or "").lower()
    label = doc.get("weergavenaam") or ""
    expected_house = expected_house_number_from_query(query)
    score = 0

    if result_type in {"adres", "nummeraanduiding"}:
        score += 40
    elif "postcode" in result_type:
        score += 20
    elif result_type in {"weg", "straat"}:
        score += 10

    if expected_house:
        if re.search(rf"\b{re.escape(expected_house)}(?![A-Z0-9])\b", label, flags=re.IGNORECASE):
            score += 100
        elif re.search(rf"\b{re.escape(expected_house)}[A-Z]\b", label, flags=re.IGNORECASE):
            score -= 20

    return score


def geocode_query_pdok(database: Session, query: str) -> GeocodeAttemptResult:
    provider = "pdok"

    if is_failed_cached(database, query, provider):
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="cached failure")

    if not wait_for_geocode_slot():
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="rate limit")

    try:
        response = requests.get(
            "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
            params={
                "q": query,
                "rows": "5",
                "fq": "type:(adres OR nummeraanduiding OR weg OR postcode OR woonplaats)",
                "fl": "type,weergavenaam,centroide_ll",
            },
            headers={"User-Agent": GEOCODE_USER_AGENT},
            timeout=GEOCODE_TIMEOUT_SECONDS,
        )
        mark_geocode_request_used()
        response.raise_for_status()
        docs = response.json().get("response", {}).get("docs", [])
    except Exception as error:
        remember_failed_query(database, query, provider, str(error))
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error=str(error))

    if not docs:
        remember_failed_query(database, query, provider, "no results")
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="no results")

    doc = max(docs, key=lambda candidate: pdok_result_score(candidate, query))
    coordinates = parse_pdok_point(doc.get("centroide_ll"))

    if not coordinates:
        remember_failed_query(database, query, provider, "missing coordinates")
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="missing coordinates")

    precision, confidence = pdok_precision(doc.get("type"))
    latitude, longitude = coordinates

    return GeocodeAttemptResult(
        query=query,
        provider=provider,
        success=True,
        latitude=latitude,
        longitude=longitude,
        precision=precision,
        confidence=confidence,
        matched_label=doc.get("weergavenaam"),
    )


def geocode_query_nominatim(
    database: Session,
    query: str,
    precision: str,
    confidence: float,
) -> GeocodeAttemptResult:
    provider = "nominatim"

    if is_failed_cached(database, query, provider):
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="cached failure")

    if not wait_for_geocode_slot():
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="rate limit")

    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "format": "json",
                "limit": "1",
                "countrycodes": "nl",
                "q": query,
            },
            headers={"User-Agent": GEOCODE_USER_AGENT},
            timeout=GEOCODE_TIMEOUT_SECONDS,
        )
        mark_geocode_request_used()
        response.raise_for_status()
        results = response.json()
    except Exception as error:
        remember_failed_query(database, query, provider, str(error))
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error=str(error))

    if not results:
        remember_failed_query(database, query, provider, "no results")
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="no results")

    first = results[0]
    try:
        latitude = float(first["lat"])
        longitude = float(first["lon"])
    except (KeyError, TypeError, ValueError):
        remember_failed_query(database, query, provider, "invalid coordinates")
        return GeocodeAttemptResult(query=query, provider=provider, success=False, error="invalid coordinates")

    return GeocodeAttemptResult(
        query=query,
        provider=provider,
        success=True,
        latitude=latitude,
        longitude=longitude,
        precision=precision,
        confidence=confidence,
        matched_label=first.get("display_name"),
    )


def geocode_location(database: Session, parts: AddressParts) -> dict | None:
    city = parts.city
    queries: list[tuple[str, str, float]] = []

    if parts.street_name and parts.house_number and city:
        street_address = f"{parts.street_name} {parts.house_number}"

        if parts.postal_code:
            queries.append(
                (
                    f"{street_address} {parts.postal_code} {city}",
                    "exact_address",
                    0.92,
                )
            )

        queries.append((f"{street_address} {city}", "exact_address", 0.82))

    if parts.postal_code and city:
        if parts.house_number:
            queries.append((f"{parts.postal_code} {parts.house_number}", "exact_address", 0.88))
        queries.append((f"{parts.postal_code} {city}", "postcode", 0.72))

    if parts.address_text:
        queries.append((
            parts.address_text.replace(", Nederland", ""),
            parts.location_precision,
            parts.location_confidence,
        ))

    seen_queries = set()
    for query, precision, confidence in queries:
        normalized_query = cache_key(query)

        if normalized_query in seen_queries:
            continue

        seen_queries.add(normalized_query)
        cached = cached_success(database, query)

        if cached:
            return cached

        pdok_result = geocode_query_pdok(database, query)

        if pdok_result.success:
            store_success(database, query, pdok_result)
            return {
                "latitude": pdok_result.latitude,
                "longitude": pdok_result.longitude,
                "location_precision": pdok_result.precision,
                "location_confidence": pdok_result.confidence,
                "address_text": address_text_from_matched_label(pdok_result.matched_label),
            }

        nominatim_query = query if query.endswith("Netherlands") else f"{query}, Netherlands"
        cached = cached_success(database, nominatim_query)

        if cached:
            return cached

        nominatim_result = geocode_query_nominatim(
            database,
            nominatim_query,
            precision,
            confidence,
        )

        if nominatim_result.success:
            store_success(database, nominatim_query, nominatim_result)
            return {
                "latitude": nominatim_result.latitude,
                "longitude": nominatim_result.longitude,
                "location_precision": nominatim_result.precision,
                "location_confidence": nominatim_result.confidence,
            }

    return None


def geocode_diagnostic(query: str, database: Session) -> list[GeocodeAttemptResult]:
    parts = extract_address_parts(query)
    diagnostic_queries: list[tuple[str, str, float]] = []

    if parts.street_name and parts.house_number and parts.city:
        street_address = f"{parts.street_name} {parts.house_number}"
        if parts.postal_code:
            diagnostic_queries.append((f"{street_address} {parts.postal_code} {parts.city}", "exact_address", 0.92))
        diagnostic_queries.append((f"{street_address} {parts.city}", "exact_address", 0.82))

    if parts.postal_code:
        if parts.house_number:
            diagnostic_queries.append((f"{parts.postal_code} {parts.house_number}", "exact_address", 0.88))
        if parts.city:
            diagnostic_queries.append((f"{parts.postal_code} {parts.city}", "postcode", 0.72))

    if not diagnostic_queries:
        diagnostic_queries.append((query, "unknown", 0.4))

    results: list[GeocodeAttemptResult] = []
    seen = set()

    for candidate, precision, confidence in diagnostic_queries:
        if cache_key(candidate) in seen:
            continue
        seen.add(cache_key(candidate))

        cached = cached_success(database, candidate)
        if cached:
            results.append(
                GeocodeAttemptResult(
                    query=candidate,
                    provider="cache",
                    success=True,
                    latitude=cached["latitude"],
                    longitude=cached["longitude"],
                    precision=cached["location_precision"],
                    confidence=cached["location_confidence"],
                )
            )
            continue

        pdok_result = geocode_query_pdok(database, candidate)
        results.append(pdok_result)
        if pdok_result.success:
            store_success(database, candidate, pdok_result)
            continue

        nominatim_candidate = f"{candidate}, Netherlands"
        cached = cached_success(database, nominatim_candidate)
        if cached:
            results.append(
                GeocodeAttemptResult(
                    query=nominatim_candidate,
                    provider="cache",
                    success=True,
                    latitude=cached["latitude"],
                    longitude=cached["longitude"],
                    precision=cached["location_precision"],
                    confidence=cached["location_confidence"],
                )
            )
            continue

        nominatim_result = geocode_query_nominatim(
            database,
            nominatim_candidate,
            precision,
            confidence,
        )
        results.append(nominatim_result)
        if nominatim_result.success:
            store_success(database, nominatim_candidate, nominatim_result)

    database.commit()
    return results


def city_coordinates(city: str | None) -> tuple[float, float] | None:
    if not city:
        return None

    return CITY_COORDINATES.get(normalize_space(city).lower())


def enrich_location(database: Session, parts: AddressParts) -> dict:
    address_text = parts.address_text or build_address_text(parts)
    precision = parts.location_precision if parts.location_precision in LOCATION_PRECISIONS else "unknown"
    confidence = parts.location_confidence

    location = {
        "address_text": address_text,
        "street_name": parts.street_name,
        "house_number": parts.house_number,
        "postal_code": parts.postal_code,
        "latitude": None,
        "longitude": None,
        "location_precision": precision,
        "location_confidence": confidence,
    }

    if address_text and precision in {"exact_address", "street", "postcode"}:
        geocoded = geocode_location(database, parts)
        if geocoded:
            location.update(geocoded)
            return location

    coords = city_coordinates(parts.city)
    if coords:
        location["latitude"] = coords[0]
        location["longitude"] = coords[1]
        if precision in {"unknown", "exact_address", "street", "postcode"}:
            location["location_precision"] = "city"
            location["location_confidence"] = 0.35
            location["address_text"] = address_text or f"{parts.city}, Nederland"

    return location


def backfill_listing_coordinates(database: Session, limit: int = 50) -> int:
    from app.models.listing import Listing

    reset_geocode_run_budget()
    enriched_count = 0
    listings = (
        database.query(Listing)
        .filter(Listing.address_text.is_not(None))
        .all()
    )

    for listing in listings:
        if enriched_count >= limit:
            break

        parts = extract_address_parts(
            " ".join(
                [
                    listing.address_text or "",
                    listing.title or "",
                    listing.description or "",
                    slug_to_text(listing.url),
                ]
            ),
            listing.city,
        )

        if parts.location_precision not in {"exact_address", "street", "postcode"}:
            continue

        location = enrich_location(database, parts)
        precision = location.get("location_precision")

        if precision not in {"exact_address", "street", "postcode"}:
            continue

        next_values = {
            "address_text": location.get("address_text") or listing.address_text,
            "street_name": location.get("street_name") or listing.street_name,
            "house_number": location.get("house_number") or listing.house_number,
            "postal_code": location.get("postal_code") or listing.postal_code,
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "location_precision": precision,
            "location_confidence": location.get("location_confidence") or listing.location_confidence,
        }

        changed = any(getattr(listing, field) != value for field, value in next_values.items())

        if not changed:
            continue

        for field, value in next_values.items():
            setattr(listing, field, value)

        enriched_count += 1

    database.commit()
    return enriched_count


def main() -> None:
    parser = argparse.ArgumentParser(description="RentScout location diagnostics")
    parser.add_argument("query", nargs="*", help="Address query to geocode")
    parser.add_argument("--backfill", action="store_true", help="Backfill existing listing coordinates")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    database = SessionLocal()
    try:
        if args.backfill:
            enriched_count = backfill_listing_coordinates(database, limit=args.limit)
            print(f"enriched_count={enriched_count}")
            return

        query = " ".join(args.query).strip()
        if not query:
            parser.error("query is required unless --backfill is used")

        for result in geocode_diagnostic(query, database):
            print(
                {
                    "query": result.query,
                    "provider": result.provider,
                    "success": result.success,
                    "latitude": result.latitude,
                    "longitude": result.longitude,
                    "precision": result.precision,
                    "confidence": result.confidence,
                    "matched_label": result.matched_label,
                    "error": result.error,
                }
            )
    finally:
        database.close()


if __name__ == "__main__":
    main()

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote_plus, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup

from app.scrapers.base import (
    ScrapedListing,
    detect_availability_status,
    extract_listing_image,
    extract_price_from_text,
    extract_area_from_text,
    extract_rooms_from_text,
    parse_postcode_city,
    split_street_and_number,
)
from app.services.browser_fetcher import fetch_page_with_browser


class SourceBlockedError(Exception):
    pass


@dataclass(frozen=True)
class GenericSourceConfig:
    source_id: str
    display_name: str
    search_url_template: str
    listing_path_markers: tuple[str, ...]
    blocked_markers: tuple[str, ...] = ()


BLOCKED_MARKERS = (
    "captcha",
    "access denied",
    "forbidden",
    "verify you are human",
    "unusual traffic",
    "login required",
    "inloggen om verder te gaan",
)

NON_LISTING_MARKERS = (
    "privacy",
    "cookies",
    "contact",
    "login",
    "inloggen",
    "account",
    "makelaar",
    "nieuws",
    "blog",
    "woningruil",
    "parkeerplaats",
    "garagebox",
    "parking",
    "gezocht",
    "ik zoek",
    "wij zoeken",
)


def normalize_city(city: str) -> str:
    return " ".join(city.split()).strip()


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def is_probable_listing_url(url: str, config: GenericSourceConfig) -> bool:
    parsed = urlparse(url.lower())

    if not parsed.netloc:
        return False

    if any(marker in parsed.path for marker in NON_LISTING_MARKERS):
        return False

    return any(marker in parsed.path for marker in config.listing_path_markers)


def listing_container_for_link(element, max_depth: int = 8):
    current = element
    best_candidate = element
    best_text_length = 0

    for _ in range(max_depth):
        if current is None:
            break

        text = current.get_text(" ", strip=True)
        if len(text) > best_text_length:
            best_candidate = current
            best_text_length = len(text)

        if "€" in text and (
            "m²" in text
            or "m2" in text.lower()
            or "slaapkamer" in text.lower()
            or "kamer" in text.lower()
        ):
            return current

        current = current.parent

    return best_candidate


def title_from_link(text: str, url: str, fallback: str) -> str:
    title = " ".join(text.split()).strip()

    if len(title) >= 5:
        return title[:140]

    slug = url.strip("/").split("/")[-1].replace("-", " ").replace("_", " ")
    return slug.title()[:140] or fallback


def fetch_generic_source_listings(
    config: GenericSourceConfig,
    city: str = "Breda",
) -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    search_url = config.search_url_template.format(city=quote_plus(requested_city.lower()))
    html = fetch_page_with_browser(search_url, debug_name=config.source_id)

    if not html:
        raise SourceBlockedError("Source returned no usable HTML or appears blocked.")

    lower_html = html.lower()
    blocked_markers = BLOCKED_MARKERS + config.blocked_markers

    if any(marker in lower_html for marker in blocked_markers):
        raise SourceBlockedError("Source appears blocked, requires login, or returned bot protection.")

    soup = BeautifulSoup(html, "html.parser")
    listings = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        href = link.get("href")

        if not href:
            continue

        full_url = canonicalize_url(urljoin(search_url, href))

        if full_url in seen_urls or not is_probable_listing_url(full_url, config):
            continue

        text = link.get_text(" ", strip=True)
        container = listing_container_for_link(link)
        context = container.get_text(" ", strip=True) if container else text
        combined = f"{text} {context} {full_url}".lower()

        if any(marker in combined for marker in NON_LISTING_MARKERS):
            continue

        seen_urls.add(full_url)
        postal_code, parsed_city = parse_postcode_city(context)
        address_line = None
        street_name = None
        house_number = None

        if postal_code and parsed_city:
            address_line = next(
                (
                    line.strip()
                    for line in context.split("  ")
                    if postal_code.replace(" ", "") in line.replace(" ", "")
                ),
                None,
            )

        if text:
            street_name, house_number = split_street_and_number(title_from_link(text, full_url, ""))

        availability_status, is_available = detect_availability_status(context)

        listings.append(
            ScrapedListing(
                title=title_from_link(text or context, full_url, f"{config.display_name} rental"),
                source=config.display_name,
                url=full_url,
                city=parsed_city or requested_city,
                price=extract_price_from_text(context),
                area_m2=extract_area_from_text(context),
                rooms=extract_rooms_from_text(context),
                image_url=extract_listing_image(soup, search_url, element=container or link),
                description=context[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=address_line,
                street_name=street_name,
                house_number=house_number,
                postal_code=postal_code,
            )
        )

    return listings

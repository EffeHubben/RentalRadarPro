from __future__ import annotations

from dataclasses import dataclass
import logging
import re
from urllib.parse import quote, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup
import requests

from app.scrapers.base import (
    ScrapedListing,
    detect_availability_status,
    extract_listing_image,
    extract_area_from_text,
    extract_price_from_text,
    extract_rooms_from_text,
    parse_postcode_city,
    split_street_and_number,
)
from app.scrapers.generic_sources import SourceBlockedError
from app.services.browser_fetcher import fetch_page_with_browser


SOURCE_NAME = "Ik wil huren"
DETAIL_TIMEOUT_SECONDS = 10
MAX_DETAIL_FETCHES_PER_RUN = 20
logger = logging.getLogger("rentscout.scrapers.ikwilhuren")


@dataclass(frozen=True)
class ListingDetail:
    description: str = ""
    image_url: str | None = None
    availability_status: str = "unknown"
    is_available: bool | None = None
    price: int | None = None
    area_m2: int | None = None
    rooms: int | None = None
    address_text: str | None = None
    postal_code: str | None = None
    city: str | None = None


def normalize_city(city: str) -> str:
    return " ".join(city.split()).strip()


def build_ikwilhuren_search_url(city: str) -> str:
    query_city = quote(normalize_city(city).lower())
    return f"https://ikwilhuren.nu/aanbod/{query_city}"


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def is_ikwilhuren_listing_url(url: str) -> bool:
    parsed = urlparse(url.lower())
    return "ikwilhuren.nu" in parsed.netloc and parsed.path.startswith("/object/")


def clean_title(text: str, address_line: str | None, city: str | None) -> str:
    title = " ".join(text.split()).strip()
    title = re.sub(r"^(appartement|eengezinswoning|woning|studio|kamer|huis)\s+", "", title, flags=re.IGNORECASE)

    if title and city:
        return f"{title}, {city}"[:140]

    if address_line:
        return address_line[:140]

    return title[:140] or "Ik wil huren woning"


def parse_card(card, search_url: str, requested_city: str) -> ScrapedListing | None:
    link = card.select_one("a.stretched-link[href]")

    if link is None:
        return None

    full_url = canonicalize_url(urljoin(search_url, link.get("href", "")))

    if not is_ikwilhuren_listing_url(full_url):
        return None

    title_text = link.get_text(" ", strip=True)
    property_prefix_match = re.match(
        r"^(appartement|eengezinswoning|woning|studio|kamer|huis)\b",
        title_text.strip(),
        flags=re.IGNORECASE,
    )
    property_prefix = property_prefix_match.group(1) if property_prefix_match else ""
    address_span = link.find_parent(class_="card-body").find("span", string=re.compile(r"\d{4}\s?[A-Z]{2}", re.IGNORECASE))
    address_line = " ".join(address_span.get_text(" ", strip=True).split()) if address_span else ""
    postal_code, parsed_city = parse_postcode_city(address_line)
    city = parsed_city or requested_city
    street_text = re.sub(r"^(appartement|eengezinswoning|woning|studio|kamer|huis)\s+", "", title_text, flags=re.IGNORECASE).strip(" ,-")
    street_name, house_number = split_street_and_number(street_text)
    badge = card.select_one(".badge")
    badge_text = badge.get_text(" ", strip=True) if badge else ""
    info_block = card.select_one(".small")
    info_text = info_block.get_text(" ", strip=True) if info_block else ""
    facts_block = card.select_one(".dotted-spans")
    facts_text = facts_block.get_text(" ", strip=True) if facts_block else ""
    combined = " ".join(part for part in [badge_text, info_text, facts_text] if part).strip()
    availability_status, is_available = detect_availability_status(combined)
    image_url = extract_listing_image(BeautifulSoup(str(card), "html.parser"), search_url)
    address_text = None

    if street_text and city:
        address_text = f"{street_text}, {city}"
        if postal_code:
            address_text = f"{street_text}, {postal_code} {city}"

    return ScrapedListing(
        title=clean_title(title_text, address_text, city),
        source=SOURCE_NAME,
        url=full_url,
        city=city,
        price=extract_price_from_text(facts_text),
        area_m2=extract_area_from_text(facts_text),
        rooms=extract_rooms_from_text(facts_text),
        image_url=image_url,
        description=" ".join(part for part in [property_prefix, info_text, facts_text] if part)[:1500],
        availability_status=availability_status,
        is_available=is_available,
        address_text=address_text,
        street_name=street_name,
        house_number=house_number,
        postal_code=postal_code,
    )


def fetch_listing_detail(url: str) -> ListingDetail:
    try:
        response = requests.get(
            url,
            timeout=DETAIL_TIMEOUT_SECONDS,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
                )
            },
        )
        response.raise_for_status()
    except requests.RequestException:
        return ListingDetail()

    soup = BeautifulSoup(response.text, "html.parser")
    detail_text = soup.get_text(" ", strip=True)
    postal_code, city = parse_postcode_city(detail_text)
    availability_status, is_available = detect_availability_status(detail_text)

    return ListingDetail(
        description=detail_text[:3000],
        image_url=extract_listing_image(soup, url),
        availability_status=availability_status,
        is_available=is_available,
        price=extract_price_from_text(detail_text),
        area_m2=extract_area_from_text(detail_text),
        rooms=extract_rooms_from_text(detail_text),
        postal_code=postal_code,
        city=city,
    )


def merge_detail_data(listing: ScrapedListing, detail: ListingDetail, fetched: bool) -> ScrapedListing:
    listing.image_url = listing.image_url or detail.image_url
    listing.price = listing.price or detail.price
    listing.area_m2 = listing.area_m2 or detail.area_m2
    listing.rooms = listing.rooms or detail.rooms
    listing.description = " ".join(part for part in [listing.description, detail.description] if part)[:1500]

    if detail.availability_status != "unknown":
        listing.availability_status = detail.availability_status
        listing.is_available = detail.is_available

    if fetched:
        listing.scrape_diagnostics["detail_pages_fetched"] = 1

    return listing


def fetch_ikwilhuren_listings(city: str = "Breda") -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    search_url = build_ikwilhuren_search_url(requested_city)
    html = fetch_page_with_browser(search_url, debug_name="ikwilhuren")

    if not html:
        raise SourceBlockedError("Source returned no usable HTML or appears blocked.")

    soup = BeautifulSoup(html, "html.parser")
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()
    detail_fetches = 0

    for card in soup.select(".card.card-woning"):
        listing = parse_card(card, search_url, requested_city)

        if listing is None or listing.url in seen_urls:
            continue

        seen_urls.add(listing.url)
        listing.scrape_diagnostics["images_found"] = 1 if listing.image_url else 0
        listing.scrape_diagnostics["missing_image"] = 0 if listing.image_url else 1
        listing.scrape_diagnostics["missing_area"] = 0 if listing.area_m2 else 1
        listing.scrape_diagnostics["missing_rooms"] = 0 if listing.rooms else 1

        needs_detail = (
            detail_fetches < MAX_DETAIL_FETCHES_PER_RUN
            and (
                not listing.image_url
                or listing.area_m2 is None
                or listing.rooms is None
                or listing.availability_status == "unknown"
            )
        )

        if needs_detail:
            detail = fetch_listing_detail(listing.url)
            detail_fetches += 1
            listing = merge_detail_data(listing, detail, fetched=True)

        listing.scrape_diagnostics["images_found"] = 1 if listing.image_url else 0
        listing.scrape_diagnostics["missing_image"] = 0 if listing.image_url else 1
        listing.scrape_diagnostics["missing_area"] = 0 if listing.area_m2 else 1
        listing.scrape_diagnostics["missing_rooms"] = 0 if listing.rooms else 1

        listings.append(listing)

    logger.info(
        "ikwilhuren_scrape city=%s listings_found=%s detail_pages_fetched=%s",
        requested_city,
        len(listings),
        detail_fetches,
    )
    return listings

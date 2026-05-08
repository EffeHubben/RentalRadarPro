from __future__ import annotations

from urllib.parse import quote, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup

from app.scrapers.base import (
    ScrapedListing,
    detect_availability_status,
    extract_listing_image,
    extract_area_from_text,
    extract_price_from_text,
    extract_rooms_from_text,
    parse_postcode_city,
)
from app.scrapers.generic_sources import SourceBlockedError
from app.services.browser_fetcher import fetch_page_with_browser


SOURCE_NAME = "Funda"


def normalize_city(city: str) -> str:
    return " ".join(city.split()).strip()


def build_funda_search_url(city: str) -> str:
    query_city = normalize_city(city).lower()
    encoded_area = quote(f'["{query_city}"]')
    return f"https://www.funda.nl/zoeken/huur/?selected_area={encoded_area}"


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def is_funda_listing_url(url: str) -> bool:
    parsed = urlparse(url.lower())

    if "funda.nl" not in parsed.netloc or "/zoeken/" in parsed.path:
        return False

    return "/huur/" in parsed.path or "/detail/huur/" in parsed.path


def is_obvious_non_listing(text: str, url: str) -> bool:
    combined_text = f"{text} {url}".lower()
    blocked = [
        "makelaar",
        "nieuwbouwprojecten",
        "recreatiewoningen",
        "zoekopdracht",
        "privacy",
        "inloggen",
        "bewaar",
    ]
    return any(keyword in combined_text for keyword in blocked)


def clean_title(text: str, url: str) -> str:
    title = " ".join(text.split())

    if len(title) >= 5:
        return title[:140]

    slug = url.strip("/").split("/")[-1]
    return slug.replace("-", " ").title()[:140] or "Funda huurwoning"


def listing_container_for_link(element, max_depth: int = 8):
    current = element
    best = element
    best_length = 0

    for _ in range(max_depth):
        if current is None:
            break

        text = current.get_text(" ", strip=True)
        if len(text) > best_length:
            best = current
            best_length = len(text)

        if "€" in text and ("m²" in text or "m2" in text.lower() or "kamer" in text.lower()):
            return current

        current = current.parent

    return best


def fetch_funda_listings(city: str = "Breda") -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    search_url = build_funda_search_url(requested_city)
    html = fetch_page_with_browser(search_url, debug_name="funda")

    if not html:
        raise SourceBlockedError("Source returned no usable HTML or appears blocked.")

    soup = BeautifulSoup(html, "html.parser")
    listings = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        href = link.get("href")
        text = link.get_text(" ", strip=True)

        if not href:
            continue

        full_url = canonicalize_url(urljoin(search_url, href))

        if not is_funda_listing_url(full_url) or full_url in seen_urls:
            continue

        container = listing_container_for_link(link)
        surrounding_text = container.get_text(" ", strip=True) if container else text

        if is_obvious_non_listing(surrounding_text or text, full_url):
            continue

        title = clean_title(text or surrounding_text, full_url)
        postal_code, parsed_city = parse_postcode_city(surrounding_text)
        availability_status, is_available = detect_availability_status(surrounding_text)
        seen_urls.add(full_url)

        listings.append(
            ScrapedListing(
                title=title,
                source=SOURCE_NAME,
                url=full_url,
                city=parsed_city or requested_city,
                price=extract_price_from_text(surrounding_text),
                area_m2=extract_area_from_text(surrounding_text),
                rooms=extract_rooms_from_text(surrounding_text),
                image_url=extract_listing_image(soup, search_url, element=container or link),
                description=surrounding_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                postal_code=postal_code,
            )
        )

    return listings

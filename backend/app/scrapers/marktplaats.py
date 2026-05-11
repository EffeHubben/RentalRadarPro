from __future__ import annotations

from urllib.parse import quote_plus, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup

from app.scrapers.base import (
    ScrapedListing,
    availability_from_schema,
    clean_image_url,
    extract_area_from_text,
    extract_json_ld_objects,
    extract_listing_image,
    extract_price_from_text,
    extract_rooms_from_text,
    is_listing_photo_url,
    parse_area_m2,
    parse_price,
    parse_room_count,
)
from app.scrapers.generic_sources import SourceBlockedError
from app.services.browser_fetcher import fetch_page_with_browser


SOURCE_NAME = "Marktplaats"

SEARCH_QUERY_TEMPLATES = [
    "studio {city}",
    "zelfstandige studio {city}",
    "appartement {city}",
    "eigen keuken {city}",
    "eigen badkamer {city}",
    "huurwoning {city}",
    "woonruimte {city}",
]


UNWANTED_KEYWORDS = [
    "op zoek naar een huis",
    "op zoek naar woning",
    "op zoek naar woonruimte",
    "zoekt appartement",
    "zoekt studio",
    "zoek appartement",
    "zoek studio",
    "zoek woning",
    "zoek woonruimte",
    "zoekt plek",
    "gezocht",
    "ik zoek",
    "wij zoeken",
    "te huur gevraagd",
    "huurwoning gezocht",
    "kamer gezocht",
    "antikraak",
    "vakantiewoning",
    "recreatiewoning",
    "recreatiewoningen",
    "opslagruimte",
]


def normalize_city(city: str) -> str:
    return " ".join(city.split()).strip()


def build_search_urls(city: str) -> list[str]:
    normalized_city = normalize_city(city)
    query_city = normalized_city.lower()

    return [
        f"https://www.marktplaats.nl/l/huizen-en-kamers/q/{quote_plus(template.format(city=query_city))}/"
        for template in SEARCH_QUERY_TEMPLATES
    ]


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def is_marktplaats_listing_url(url: str) -> bool:
    url_lower = url.lower()
    parsed_url = urlparse(url_lower)

    if "marktplaats.nl" not in parsed_url.netloc:
        return False

    if "/v/huizen-en-kamers/" not in url_lower:
        return False

    if "/op-zoek-naar-een-huis/" in url_lower:
        return False

    if "te-koop" in url_lower or "recreatiewoningen" in url_lower:
        return False

    return True


def is_relevant_listing(title: str, description: str, url: str) -> bool:
    combined_text = f"{title} {description} {url}".lower()
    return not any(keyword in combined_text for keyword in UNWANTED_KEYWORDS)


def clean_title(text: str, url: str = "") -> str:
    cleaned = " ".join(text.split())

    cut_phrases = [
        " Gelegen in ",
        " Deze studio ",
        " De studio ",
        " Zoek jij ",
        " Met een ",
        " Via de ",
        " Bij binnenkomst ",
        " De woning ",
    ]

    for phrase in cut_phrases:
        if phrase in cleaned:
            cleaned = cleaned.split(phrase)[0]

    if len(cleaned) >= 5:
        return cleaned[:140]

    parts = url.strip("/").split("/")
    if parts:
        return parts[-1].replace("-", " ").title()[:140]

    return "Rental listing"


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

        if "€" in text and len(text) > 20:
            return current

        current = current.parent

    return best


def _extract_json_ld_image(raw, search_url: str) -> str | None:
    """Resolve image from a JSON-LD value that may be str, list, or ImageObject dict."""
    if isinstance(raw, str):
        candidate = raw
    elif isinstance(raw, list) and raw:
        first = raw[0]
        if isinstance(first, str):
            candidate = first
        elif isinstance(first, dict):
            candidate = first.get("url") or first.get("contentUrl") or ""
        else:
            return None
    elif isinstance(raw, dict):
        candidate = raw.get("url") or raw.get("contentUrl") or ""
    else:
        return None

    cleaned = clean_image_url(candidate, search_url)
    return cleaned if is_listing_photo_url(cleaned) else None


def _enrich_images_from_html(
    listings: list[ScrapedListing], soup: BeautifulSoup, search_url: str
) -> None:
    """Fill missing image_url by searching the Playwright-rendered page HTML."""
    needs_image = {listing.url: listing for listing in listings if not listing.image_url}
    if not needs_image:
        return

    for a_tag in soup.find_all("a", href=True):
        if not needs_image:
            break
        full_url = canonicalize_url(urljoin(search_url, a_tag.get("href", "")))
        listing = needs_image.get(full_url)
        if listing is None:
            continue

        container = listing_container_for_link(a_tag, max_depth=10)
        for img in container.find_all("img"):
            src = (
                img.get("src")
                or img.get("data-src")
                or img.get("data-lazy")
                or img.get("data-original")
                or ""
            )
            cleaned = clean_image_url(src, search_url)
            if cleaned and is_listing_photo_url(cleaned):
                listing.image_url = cleaned
                needs_image.pop(full_url, None)
                break


def listings_from_json_ld(soup: BeautifulSoup, search_url: str, requested_city: str) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []

    for item in extract_json_ld_objects(soup):
        if item.get("@type") != "ItemList":
            continue

        for element in item.get("itemListElement", []):
            payload = element.get("item") if isinstance(element, dict) else None

            if not isinstance(payload, dict):
                continue

            full_url = canonicalize_url(urljoin(search_url, payload.get("url", "")))

            if not is_marktplaats_listing_url(full_url):
                continue

            title = clean_title(payload.get("name", ""), full_url)
            description = payload.get("description", "")

            if not is_relevant_listing(title, description, full_url):
                continue

            offers = payload.get("offers", {}) if isinstance(payload.get("offers"), dict) else {}
            availability_status, is_available = availability_from_schema(offers.get("availability"))
            image_url = _extract_json_ld_image(payload.get("image"), search_url)

            listings.append(
                ScrapedListing(
                    title=title,
                    source=SOURCE_NAME,
                    url=full_url,
                    city=requested_city,
                    price=parse_price(offers.get("price")) or extract_price_from_text(description),
                    area_m2=parse_area_m2(payload.get("floorSize")) or extract_area_from_text(description),
                    rooms=parse_room_count(payload.get("numberOfRooms")) or extract_rooms_from_text(
                        f"{title} {description}"
                    ),
                    image_url=image_url,
                    description=description[:1500],
                    availability_status=availability_status,
                    is_available=is_available,
                )
            )

    # Listings without images get a second chance via the rendered HTML
    if listings:
        _enrich_images_from_html(listings, soup, search_url)

    return listings


def fetch_marktplaats_listings(city: str = "Breda") -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    listings = []
    seen_urls = set()
    search_urls = build_search_urls(requested_city)
    successful_fetches = 0

    for index, search_url in enumerate(search_urls):
        html = fetch_page_with_browser(search_url, debug_name=f"marktplaats_{index + 1}")

        if not html:
            continue

        successful_fetches += 1
        soup = BeautifulSoup(html, "html.parser")
        structured = listings_from_json_ld(soup, search_url, requested_city)

        if structured:
            for listing in structured:
                if listing.url in seen_urls:
                    continue
                seen_urls.add(listing.url)
                listings.append(listing)
            continue

        for link in soup.find_all("a", href=True):
            href = link.get("href")
            text = link.get_text(" ", strip=True)

            if not href:
                continue

            full_url = canonicalize_url(urljoin(search_url, href))

            if not is_marktplaats_listing_url(full_url) or full_url in seen_urls:
                continue

            container = listing_container_for_link(link)
            surrounding_text = container.get_text(" ", strip=True) if container else text
            title = clean_title(text, full_url)

            if not is_relevant_listing(title, surrounding_text, full_url):
                continue

            seen_urls.add(full_url)
            # Try container first, then search the img tags directly in the container
            img_url = extract_listing_image(soup, search_url, element=container or link)
            if not img_url and container:
                for img in container.find_all("img"):
                    src = (
                        img.get("src")
                        or img.get("data-src")
                        or img.get("data-lazy")
                        or img.get("data-original")
                        or ""
                    )
                    cleaned = clean_image_url(src, search_url)
                    if cleaned and is_listing_photo_url(cleaned):
                        img_url = cleaned
                        break
            listings.append(
                ScrapedListing(
                    title=title,
                    source=SOURCE_NAME,
                    url=full_url,
                    city=requested_city,
                    price=extract_price_from_text(surrounding_text),
                    area_m2=extract_area_from_text(surrounding_text),
                    rooms=extract_rooms_from_text(surrounding_text),
                    image_url=img_url,
                    description=surrounding_text[:1500],
                )
            )

    if successful_fetches == 0:
        raise SourceBlockedError("Source returned no usable HTML or appears blocked.")

    return listings

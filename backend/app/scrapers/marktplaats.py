from bs4 import BeautifulSoup
from urllib.parse import quote_plus, urljoin, urlparse, urlunparse

from app.scrapers.base import (
    ScrapedListing,
    extract_area_from_text,
    extract_price_from_text,
    extract_rooms_from_text,
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

    if any(keyword in combined_text for keyword in UNWANTED_KEYWORDS):
        return False

    return True


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
        slug = parts[-1]
        words = slug.replace("-", " ").title()
        return words[:140]

    return "Rental listing"


def get_surrounding_text(element, max_depth: int = 8) -> str:
    current = element
    best_text = ""

    for _ in range(max_depth):
        if current is None:
            break

        text = current.get_text(" ", strip=True)

        if len(text) > len(best_text):
            best_text = text

        if "€" in text and len(text) > 20:
            return text

        current = current.parent

    return best_text


def get_image_url(element, base_url: str) -> str | None:
    current = element

    for _ in range(8):
        if current is None:
            break

        image = current.find("img") if hasattr(current, "find") else None

        if image:
            src = image.get("src") or image.get("data-src")

            if src:
                return urljoin(base_url, src)

        current = current.parent

    return None


def fetch_marktplaats_listings(city: str = "Breda") -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    listings = []
    seen_urls = set()
    search_urls = build_search_urls(requested_city)
    successful_fetches = 0

    for index, search_url in enumerate(search_urls):
        html = fetch_page_with_browser(
            search_url,
            debug_name=f"marktplaats_{index + 1}",
        )

        if not html:
            continue

        successful_fetches += 1

        soup = BeautifulSoup(html, "html.parser")

        for link in soup.find_all("a", href=True):
            href = link.get("href")
            text = link.get_text(" ", strip=True)

            if not href:
                continue

            full_url = urljoin(search_url, href)
            full_url = canonicalize_url(full_url)

            if not is_marktplaats_listing_url(full_url):
                continue

            if full_url in seen_urls:
                continue

            surrounding_text = get_surrounding_text(link)
            title = clean_title(text, full_url)
            price = extract_price_from_text(surrounding_text)
            area_m2 = extract_area_from_text(surrounding_text)
            rooms = extract_rooms_from_text(surrounding_text)
            image_url = get_image_url(link, search_url)

            if not is_relevant_listing(title, surrounding_text, full_url):
                continue

            seen_urls.add(full_url)

            listings.append(
                ScrapedListing(
                    title=title,
                    source=SOURCE_NAME,
                    url=full_url,
                    city=requested_city,
                    price=price,
                    area_m2=area_m2,
                    rooms=rooms,
                    image_url=image_url,
                    description=surrounding_text[:1500],
                )
            )

    if successful_fetches == 0:
        raise SourceBlockedError("Source returned no usable HTML or appears blocked.")

    return listings

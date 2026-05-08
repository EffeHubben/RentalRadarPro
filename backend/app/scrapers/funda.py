from bs4 import BeautifulSoup
from urllib.parse import quote, urljoin, urlparse, urlunparse

from app.scrapers.base import (
    ScrapedListing,
    extract_area_from_text,
    extract_price_from_text,
    extract_rooms_from_text,
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

    if "funda.nl" not in parsed.netloc:
        return False

    if "/zoeken/" in parsed.path:
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


def get_surrounding_text(element, max_depth: int = 8) -> str:
    current = element
    best_text = ""

    for _ in range(max_depth):
        if current is None:
            break

        text = current.get_text(" ", strip=True)

        if len(text) > len(best_text):
            best_text = text

        if "€" in text and ("m²" in text or "m2" in text.lower()):
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
            src = image.get("src") or image.get("data-src") or image.get("data-lazy")

            if src:
                return urljoin(base_url, src)

        current = current.parent

    return None


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

        if not is_funda_listing_url(full_url):
            continue

        if full_url in seen_urls:
            continue

        surrounding_text = get_surrounding_text(link)

        if is_obvious_non_listing(surrounding_text or text, full_url):
            continue

        title = clean_title(text or surrounding_text, full_url)
        seen_urls.add(full_url)

        listings.append(
            ScrapedListing(
                title=title,
                source=SOURCE_NAME,
                url=full_url,
                city=requested_city,
                price=extract_price_from_text(surrounding_text),
                area_m2=extract_area_from_text(surrounding_text),
                rooms=extract_rooms_from_text(surrounding_text),
                image_url=get_image_url(link, search_url),
                description=surrounding_text[:1500],
            )
        )

    return listings

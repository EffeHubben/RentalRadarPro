from bs4 import BeautifulSoup
import requests
from urllib.parse import quote, urljoin, urlparse, urlunparse

from app.scrapers.base import (
    ScrapedListing,
    detect_availability_status,
    extract_area_from_text,
    extract_price_from_text,
    extract_rooms_from_text,
)
from app.services.browser_fetcher import fetch_page_with_browser


SOURCE_NAME = "Ik wil huren"
DETAIL_TIMEOUT_SECONDS = 10


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

    if "ikwilhuren.nu" not in parsed.netloc:
        return False

    return parsed.path.startswith("/object/")


def is_obvious_non_listing(text: str, url: str) -> bool:
    combined_text = f"{text} {url}".lower()
    blocked = [
        "veelgestelde vragen",
        "gebruikersvoorwaarden",
        "privacy",
        "contact",
        "disclaimer",
        "inloggen",
    ]
    return any(keyword in combined_text for keyword in blocked)


def clean_title(text: str, url: str) -> str:
    title = " ".join(text.split())
    prefixes = ["Te huur ", "Verhuurd ", "Gereserveerd ", "Verhuurd onder voorbehoud "]

    for prefix in prefixes:
        if title.startswith(prefix):
            title = title[len(prefix) :]

    if len(title) >= 5:
        return title[:140]

    slug = url.strip("/").split("/")[-1]
    return slug.replace("-", " ").title()[:140] or "Ik wil huren woning"


def get_surrounding_text(element, max_depth: int = 8) -> str:
    current = element
    best_text = ""

    for _ in range(max_depth):
        if current is None:
            break

        text = current.get_text(" ", strip=True)

        if len(text) > len(best_text):
            best_text = text

        if "€" in text and ("m²" in text or "m2" in text.lower() or "slaapkamer" in text.lower()):
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
            src = (
                image.get("src")
                or image.get("data-src")
                or image.get("data-lazy")
                or image.get("data-original")
                or image.get("srcset", "").split(" ")[0]
            )

            if src:
                return urljoin(base_url, src)

        current = current.parent

    return None


def image_from_style(style: str, base_url: str) -> str | None:
    if not style:
        return None

    marker = "url("
    lower_style = style.lower()

    if marker not in lower_style:
        return None

    start = lower_style.find(marker) + len(marker)
    end = lower_style.find(")", start)

    if end == -1:
        return None

    raw_url = style[start:end].strip(" '\"")
    return urljoin(base_url, raw_url) if raw_url else None


def is_real_image_url(url: str | None) -> bool:
    if not url:
        return False

    lowered = url.lower()
    blocked_markers = [
        "logo",
        "placeholder",
        "photo_waiting",
        "icon",
        "spinner",
        "data:image/svg",
    ]

    return not any(marker in lowered for marker in blocked_markers)


def extract_main_image_from_soup(soup: BeautifulSoup, base_url: str) -> str | None:
    meta_selectors = [
        ("meta", {"property": "og:image"}),
        ("meta", {"name": "twitter:image"}),
    ]

    for tag_name, attrs in meta_selectors:
        meta = soup.find(tag_name, attrs=attrs)
        content = meta.get("content") if meta else None

        if is_real_image_url(content):
            return urljoin(base_url, content)

    for image in soup.find_all("img"):
        src = (
            image.get("src")
            or image.get("data-src")
            or image.get("data-lazy")
            or image.get("data-original")
            or image.get("srcset", "").split(" ")[0]
        )

        if is_real_image_url(src):
            return urljoin(base_url, src)

    for element in soup.find_all(style=True):
        image_url = image_from_style(element.get("style", ""), base_url)

        if is_real_image_url(image_url):
            return image_url

    return None


def fetch_listing_detail(url: str) -> tuple[str, str | None, str, bool | None]:
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
        return "", None, "unknown", None

    soup = BeautifulSoup(response.text, "html.parser")
    detail_text = soup.get_text(" ", strip=True)
    image_url = extract_main_image_from_soup(soup, url)
    availability_status, is_available = detect_availability_status(detail_text)

    return detail_text, image_url, availability_status, is_available


def fetch_ikwilhuren_listings(city: str = "Breda") -> list[ScrapedListing]:
    requested_city = normalize_city(city) or "Breda"
    search_url = build_ikwilhuren_search_url(requested_city)
    html = fetch_page_with_browser(search_url, debug_name="ikwilhuren")

    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    listings = []
    seen_urls = set()

    for link in soup.find_all("a", href=True):
        href = link.get("href")
        text = link.get_text(" ", strip=True)

        if not href:
            continue

        full_url = canonicalize_url(urljoin(search_url, href))

        if not is_ikwilhuren_listing_url(full_url):
            continue

        if full_url in seen_urls:
            continue

        surrounding_text = get_surrounding_text(link)

        if is_obvious_non_listing(surrounding_text or text, full_url):
            continue

        title = clean_title(text or surrounding_text, full_url)
        seen_urls.add(full_url)
        image_url = get_image_url(link, search_url)
        detail_text = ""
        detail_availability_status = "unknown"
        detail_is_available = None

        if not is_real_image_url(image_url):
            (
                detail_text,
                detail_image_url,
                detail_availability_status,
                detail_is_available,
            ) = fetch_listing_detail(full_url)
            image_url = detail_image_url or image_url
        else:
            detail_text, _, detail_availability_status, detail_is_available = fetch_listing_detail(full_url)

        combined_description = f"{surrounding_text} {detail_text}".strip()
        overview_availability_status, overview_is_available = detect_availability_status(
            f"{title} {surrounding_text}"
        )
        availability_status = (
            detail_availability_status
            if detail_availability_status != "unknown"
            else overview_availability_status
        )
        is_available = detail_is_available if detail_is_available is not None else overview_is_available

        listings.append(
            ScrapedListing(
                title=title,
                source=SOURCE_NAME,
                url=full_url,
                city=requested_city,
                price=extract_price_from_text(surrounding_text),
                area_m2=extract_area_from_text(surrounding_text),
                rooms=extract_rooms_from_text(surrounding_text),
                image_url=image_url if is_real_image_url(image_url) else None,
                description=combined_description[:1500],
                availability_status=availability_status,
                is_available=is_available,
            )
        )

    return listings

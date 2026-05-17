from __future__ import annotations

from dataclasses import dataclass
import re
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
    parse_price,
    parse_area_m2,
    parse_room_count,
    split_street_and_number,
)
from app.services.browser_fetcher import fetch_page_with_browser
from app.scrapers.runtime_diagnostics import add_metric, set_metric


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
    "access denied",
    "request blocked",
    "403 forbidden",
    "verify you are human",
    "unusual traffic",
    "complete the captcha",
    "captcha challenge",
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

STRICT_CITY_FILTER_SOURCE_IDS = {
    "heimstaden",
    "interhouse",
    "maxx_aanhuur",
}


def normalize_city(city: str) -> str:
    return " ".join(city.split()).strip()


def normalize_city_key(city: str | None) -> str:
    return " ".join((city or "").lower().replace("-", " ").split())


def listing_matches_requested_city(listing: ScrapedListing, requested_city: str) -> bool:
    listing_city = normalize_city_key(listing.city)
    if not listing_city:
        return True

    return listing_city == normalize_city_key(requested_city)


def filter_requested_city(
    listings: list[ScrapedListing],
    requested_city: str,
    *,
    strict: bool,
) -> list[ScrapedListing]:
    if not strict:
        return listings

    filtered = [listing for listing in listings if listing_matches_requested_city(listing, requested_city)]
    add_metric("city_mismatch_filtered", len(listings) - len(filtered))
    return filtered


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


def normalized_text(element) -> str:
    if element is None:
        return ""

    return " ".join(element.get_text(" ", strip=True).split()).strip()


def absolute_listing_url(search_url: str, href: str | None) -> str | None:
    if not href:
        return None

    full_url = canonicalize_url(urljoin(search_url, href))
    return full_url or None


def first_element_text(element, selector: str) -> str:
    if element is None:
        return ""

    return normalized_text(element.select_one(selector))


def first_valid_listing_image(element, search_url: str, soup: BeautifulSoup) -> str | None:
    return extract_listing_image(soup, search_url, element=element)


def build_address_title(address: str, city: str | None, fallback_url: str, fallback_source: str) -> str:
    normalized_address = " ".join((address or "").split()).strip()
    normalized_city = " ".join((city or "").split()).strip()

    if normalized_address and normalized_city:
        return f"{normalized_address}, {normalized_city}"

    if normalized_address:
        return normalized_address[:140]

    return title_from_link("", fallback_url, f"{fallback_source} rental")


def parse_integer_text(value: str | None, *, minimum: int, maximum: int) -> int | None:
    normalized = " ".join((value or "").split()).strip()

    if not normalized or not normalized.isdigit():
        return None

    parsed = int(normalized)
    return parsed if minimum <= parsed <= maximum else None


def parse_area_value(value: str | None) -> int | None:
    return parse_area_m2(value) or parse_integer_text(value, minimum=5, maximum=500)


def parse_room_value(value: str | None) -> int | None:
    return parse_room_count(value) or parse_integer_text(value, minimum=1, maximum=20)


def parse_expat_rentals_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select("div.rental"):
        link = card.select_one("a.title[href]") or card.select_one("div.spaced.image a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)

        raw_title = first_element_text(card, "a.title")
        raw_title = re.sub(r"\bNEW\b", "", raw_title, flags=re.IGNORECASE).strip(" -")
        subtitle = first_element_text(card, "div.subtitle")
        description = first_element_text(card, "div.desc")
        city = subtitle.split(",", 1)[0].strip() or requested_city
        price = parse_price(first_element_text(card, "div.priceNumber"))
        rooms = parse_room_value(first_element_text(card, "div.further"))
        area_m2 = parse_area_m2(" ".join(part for part in [description, normalized_text(card)] if part))
        availability_status, is_available = detect_availability_status(" ".join([normalized_text(card), description]))
        street_name, house_number = split_street_and_number(raw_title)

        listings.append(
            ScrapedListing(
                title=build_address_title(raw_title, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=price,
                area_m2=area_m2,
                rooms=rooms,
                image_url=first_valid_listing_image(card, search_url, soup),
                description=description[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_heimstaden_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select("div.object-card, .object-card__inner"):
        link = card.select_one("a[href*='/huurwoningen/'], a[href*='/projecten/']") or card.find_parent("a")
        if not link and card.name == "a":
            link = card
            
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)

        location_text = first_element_text(card, ".object-card__location")
        city = location_text.split("/", 1)[0].strip() or requested_city
        address = first_element_text(card, ".object-card__address")
        
        # Refined extraction for price, area, rooms
        price_text = first_element_text(card, ".object-card__data-prize, .object-card__price")
        area_text = first_element_text(card, ".object-card__data-size, .object-card__size")
        rooms_text = first_element_text(card, ".object-card__data-rooms, .object-card__rooms")
        
        description = normalized_text(card)
        availability_text = first_element_text(card, ".object-card__availability")
        availability_status, is_available = detect_availability_status(availability_text or description)
        street_name, house_number = split_street_and_number(address)

        listings.append(
            ScrapedListing(
                title=build_address_title(address, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=parse_price(price_text or description),
                area_m2=parse_area_value(area_text or description),
                rooms=parse_room_value(rooms_text or description),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=description[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=address or None,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return filter_requested_city(listings, requested_city, strict=True)


def parse_interhouse_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select("a.c-result-item.building-result[href*='/vastgoed/huur/'], .property-item, .listing-item"):
        link = card if card.name == "a" else card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".c-result-item__title-address, .title, h3, h2")
        city_text = first_element_text(card, ".c-result-item__location-label, .city, .location") or requested_city
        price_text = first_element_text(card, ".c-result-item__price-label, .price")
        data_values = [
            normalized_text(value)
            for value in card.select(".c-result-item__data-value")
            if normalized_text(value)
        ]
        area_text = next((value for value in data_values if "m" in value.lower()), "")
        area_index = data_values.index(area_text) if area_text in data_values else -1
        rooms_text = next(
            (
                value
                for value in data_values[area_index + 1 :]
                if re.fullmatch(r"\d{1,2}", value)
            ),
            "",
        )
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(area_text or details_text),
                rooms=parse_room_value(rooms_text or details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=f"{title}, {city_text}" if title and city_text else title or None,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return filter_requested_city(listings, requested_city, strict=True)


def parse_huislijn_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, article"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=f"{title}, {city_text}" if title and city_text else title or None,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_vesteda_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for link in soup.select("a[href*='/nl/huurwoning']"):
        full_url = absolute_listing_url(search_url, link.get("href"))
        if not full_url or full_url in seen_urls:
            continue

        card = link.find_parent("article") or link.find_parent("div", class_=re.compile(r"o-card"))
        if card is None:
            continue

        seen_urls.add(full_url)
        summary = first_element_text(card, ".js--map__summary") or normalized_text(link)
        location_text = first_element_text(card, ".js--map__location")
        city = location_text.split(",", 1)[0].strip() or requested_city
        description = normalized_text(card)
        availability_status, is_available = detect_availability_status(description)
        street_name, house_number = split_street_and_number(summary)

        listings.append(
            ScrapedListing(
                title=build_address_title(summary, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=parse_price(first_element_text(card, ".js--map__price") or description),
                area_m2=parse_area_value(first_element_text(card, ".js--map__size") or description),
                rooms=parse_room_value(first_element_text(card, ".js--map__rooms") or description),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=description[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_123wonen_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".woning-listing, .woning-omschrijving"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".woning-title, h2")
        address = first_element_text(card, ".woning-adres, .address")
        city = first_element_text(card, ".woning-plaats, .city") or requested_city
        price_text = first_element_text(card, ".woning-prijs, .price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(address or title)

        listings.append(
            ScrapedListing(
                title=build_address_title(address or title, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=f"{address or title}, {city}" if (address or title) and city else address or title or None,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_nederwoon_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".aanbod-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".aanbod-item-title, h3")
        city_text = first_element_text(card, ".aanbod-item-city, .city") or requested_city
        price_text = first_element_text(card, ".aanbod-item-price, .price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                address_text=f"{title}, {city_text}" if title and city_text else title or None,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_rotsvast_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select("a.card--house[href*='/huren/'], .rotsvast-listing-item, article.listing"):
        link = card if card.name == "a" else card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        address = first_element_text(card, ".card-house__title, .address, h3")
        city_text = first_element_text(card, ".card-house__text, .city, .location") or requested_city
        price_text = first_element_text(card, ".card-house__content > .card-house__text:last-child, .price")
        facts = [
            normalized_text(item)
            for item in card.select(".card-house__list li")
            if normalized_text(item)
        ]
        area_text = next((value for value in facts if "m" in value.lower()), "")
        area_index = facts.index(area_text) if area_text in facts else -1
        rooms_text = next(
            (
                value
                for value in facts[area_index + 1 :]
                if re.fullmatch(r"\d{1,2}", value)
            ),
            "",
        )
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(address)

        listings.append(
            ScrapedListing(
                title=build_address_title(address, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(area_text or details_text),
                rooms=parse_room_value(rooms_text or details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_househunting_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h2")
        city_text = first_element_text(card, ".location, .city") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_huurwoningen_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-search-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".listing-search-item__title, h2")
        address = first_element_text(card, ".listing-search-item__sub-title, .address")
        city = first_element_text(card, ".listing-search-item__city, .city") or requested_city
        price_text = first_element_text(card, ".listing-search-item__price, .price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(address or title)

        listings.append(
            ScrapedListing(
                title=build_address_title(address or title, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_directwonen_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h2")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_huurportaal_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_huurwoningportaal_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_pandomo_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".property-card, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".location, .city") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_friendly_housing_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".property-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h2")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_acasa_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_rentcompany_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".property-card, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_domica_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_pararius_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    # Pararius often uses section.listing-search-item
    for card in soup.select("section.listing-search-item, .listing-search-item"):
        link = card.select_one("a[href*='-te-huur/']")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".listing-search-item__title, h2")
        subtitle = first_element_text(card, ".listing-search-item__sub-title, .location")
        price_text = first_element_text(card, ".listing-search-item__price, .price")
        
        # Pararius details are often in a list
        details_text = normalized_text(card.select_one(".listing-search-item__features")) or normalized_text(card)
        
        city = requested_city
        if subtitle and "," in subtitle:
            city = subtitle.split(",")[-1].strip()

        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_kamernet_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, [class*='SearchResult']"):
        link = card.select_one("a[href*='/huren/']")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        
        # Kamernet is room-focused, area is often small
        area_m2 = parse_area_value(details_text)
        rooms = parse_room_value(details_text)
        
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, requested_city, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=requested_city,
                price=parse_price(price_text),
                area_m2=area_m2,
                rooms=rooms,
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_liv_residential_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".property-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_bwhousing_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_tvn_real_estate_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_maxx_aanhuur_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_vbt_verhuurmakelaars_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_count(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_maxx_aanhuur_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select("a.object[href*='/objects/ads/view/'], .listing-item, .property-card, .aanbod-item"):
        link = card if card.name == "a" else card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".text-block-34, .title, h3, h2")
        city_text = first_element_text(card, ".plaatsnaam-object, .city, .location") or requested_city
        price_text = first_element_text(card, ".huurprijs-object, .price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return filter_requested_city(listings, requested_city, strict=True)


def parse_friendly_housing_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".property-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h2")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_ymere_huur_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".aanbod-item, .listing-item"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_duwo_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .property-card, .residence"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_xior_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .residence-card"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


def parse_sshxl_listings(
    soup: BeautifulSoup,
    search_url: str,
    requested_city: str,
    config: GenericSourceConfig,
) -> list[ScrapedListing]:
    listings: list[ScrapedListing] = []
    seen_urls: set[str] = set()

    for card in soup.select(".listing-item, .residence"):
        link = card.select_one("a[href]")
        full_url = absolute_listing_url(search_url, link.get("href") if link else None)

        if not full_url or full_url in seen_urls:
            continue

        seen_urls.add(full_url)
        title = first_element_text(card, ".title, h3")
        city_text = first_element_text(card, ".city, .location") or requested_city
        price_text = first_element_text(card, ".price")
        details_text = normalized_text(card)
        availability_status, is_available = detect_availability_status(details_text)
        street_name, house_number = split_street_and_number(title)

        listings.append(
            ScrapedListing(
                title=build_address_title(title, city_text, full_url, config.display_name),
                source=config.display_name,
                url=full_url,
                city=city_text,
                price=parse_price(price_text),
                area_m2=parse_area_value(details_text),
                rooms=parse_room_value(details_text),
                image_url=first_valid_listing_image(card, search_url, soup),
                description=details_text[:1500],
                availability_status=availability_status,
                is_available=is_available,
                street_name=street_name,
                house_number=house_number,
            )
        )

    return listings


SOURCE_SPECIFIC_PARSERS = {
    "expat_rentals": parse_expat_rentals_listings,
    "heimstaden": parse_heimstaden_listings,
    "vesteda": parse_vesteda_listings,
    "123wonen": parse_123wonen_listings,
    "nederwoon": parse_nederwoon_listings,
    "rotsvast": parse_rotsvast_listings,
    "househunting": parse_househunting_listings,
    "huurwoningen": parse_huurwoningen_listings,
    "directwonen": parse_directwonen_listings,
    "huurportaal": parse_huurportaal_listings,
    "huurwoningportaal": parse_huurwoningportaal_listings,
    "pandomo": parse_pandomo_listings,
    "friendly_housing": parse_friendly_housing_listings,
    "acasa": parse_acasa_listings,
    "rentcompany": parse_rentcompany_listings,
    "domica": parse_domica_listings,
    "pararius": parse_pararius_listings,
    "kamernet": parse_kamernet_listings,
    "interhouse": parse_interhouse_listings,
    "huislijn": parse_huislijn_listings,
    "liv_residential": parse_liv_residential_listings,
    "bwhousing": parse_bwhousing_listings,
    "tvn_real_estate": parse_tvn_real_estate_listings,
    "maxx_aanhuur": parse_maxx_aanhuur_listings,
    "vbt_verhuurmakelaars": parse_vbt_verhuurmakelaars_listings,
    "ymere_huur": parse_ymere_huur_listings,
    "duwo": parse_duwo_listings,
    "xior": parse_xior_listings,
    "sshxl": parse_sshxl_listings,
}


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
    raw_candidate_urls = {
        canonicalize_url(urljoin(search_url, link.get("href", "")))
        for link in soup.find_all("a", href=True)
        if is_probable_listing_url(canonicalize_url(urljoin(search_url, link.get("href", ""))), config)
    }
    set_metric("raw_candidates_found", len(raw_candidate_urls))
    parser = SOURCE_SPECIFIC_PARSERS.get(config.source_id)
    if parser is not None:
        listings = parser(soup, search_url, requested_city, config)
        set_metric("parsed_successfully", len(listings))
        return listings

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

    listings = filter_requested_city(
        listings,
        requested_city,
        strict=config.source_id in STRICT_CITY_FILTER_SOURCE_IDS,
    )
    set_metric("parsed_successfully", len(listings))
    return listings

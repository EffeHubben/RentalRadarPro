from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from bs4 import BeautifulSoup

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-scraper-quality-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-scraper-quality-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.scrapers.ikwilhuren as ikwilhuren_scraper
import app.scrapers.marktplaats as marktplaats_scraper
from app.scrapers.base import (
    availability_from_schema,
    detect_availability_status,
    extract_listing_image,
    parse_area_m2,
    parse_postcode_city,
    parse_price,
    parse_room_count,
)


FIXTURE_DIR = Path(__file__).resolve().parents[1] / "debug"


def read_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


def test_ikwilhuren_overview_parses_photo_price_area_rooms_and_address(monkeypatch) -> None:
    html = read_fixture("ikwilhuren.html")
    monkeypatch.setattr(ikwilhuren_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)
    monkeypatch.setattr(ikwilhuren_scraper, "fetch_listing_detail", lambda _url: ikwilhuren_scraper.ListingDetail())

    listings = ikwilhuren_scraper.fetch_ikwilhuren_listings("Breda")
    listing = next(item for item in listings if "terheijdenstraat" in item.url.lower())

    assert listing.title == "Terheijdenstraat 340, Breda"
    assert listing.image_url == "https://b.static.nbo.nl/media/23/23b9b48ab43e7b7ba6c9d5f4f738c0ab/768x510/thumb.jpg"
    assert listing.price == 1300
    assert listing.area_m2 == 87
    assert listing.rooms == 2
    assert listing.availability_status == "available"
    assert listing.city == "Breda"
    assert listing.postal_code == "4816 BX"
    assert listing.street_name == "Terheijdenstraat"
    assert listing.house_number == "340"


def test_ikwilhuren_reserved_listing_is_not_marked_new(monkeypatch) -> None:
    html = read_fixture("ikwilhuren.html")
    monkeypatch.setattr(ikwilhuren_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)
    monkeypatch.setattr(ikwilhuren_scraper, "fetch_listing_detail", lambda _url: ikwilhuren_scraper.ListingDetail())

    listings = ikwilhuren_scraper.fetch_ikwilhuren_listings("Breda")
    listing = next(item for item in listings if "maasdijk" in item.url.lower())

    assert listing.availability_status == "reserved"
    assert listing.is_available is False


def test_marktplaats_json_ld_parses_image_price_area_and_rooms(monkeypatch) -> None:
    html = read_fixture("marktplaats_1.html")

    def fake_fetch(url: str, **_kwargs) -> str | None:
        return html if "studio+breda" in url else None

    monkeypatch.setattr(marktplaats_scraper, "fetch_page_with_browser", fake_fetch)

    listings = marktplaats_scraper.fetch_marktplaats_listings("Breda")
    listing = next(item for item in listings if "studio-haagdijk" in item.url.lower())

    assert listing.image_url == "https://admarkt-cdn.marktplaats.com/api/v1/icas-mp-pro-admarkt/images/4d/4ddbbfe7-5ef8-48d0-9a5c-db2c58ee018a?rule=eps_82"
    assert listing.price == 612
    assert listing.area_m2 == 44
    assert listing.rooms == 1
    assert listing.availability_status == "available"


def test_extract_listing_image_prefers_real_property_photo() -> None:
    html = """
    <html>
      <head>
        <meta property="og:image" content="https://example.com/logo.png" />
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Residence","image":["/media/home-1.jpg"]}
        </script>
      </head>
    </html>
    """
    soup = BeautifulSoup(html, "html.parser")

    assert extract_listing_image(soup, "https://example.com/listing/1") == "https://example.com/media/home-1.jpg"


def test_extract_listing_image_rejects_placeholder_and_normalizes_relative_url() -> None:
    html = """
    <html><body>
      <img src="/static/images/placeholder/photo_waiting_82.png" />
      <img src="/media/listings/main.jpg" />
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")

    assert extract_listing_image(soup, "https://example.com/listing/1") == "https://example.com/media/listings/main.jpg"


def test_parse_price_area_rooms_and_postcode_city_from_realistic_text() -> None:
    assert parse_price("€ 1.550,- /mnd") == 1550
    assert parse_area_m2("66 m² 2 slaapkamers") == 66
    assert parse_room_count("66 m² 2 slaapkamers") == 2
    assert parse_room_count("Studio te huur in Breda - 19 m² - 1 kamer(s)") == 1
    assert parse_postcode_city("2014SL Haarlem - 2Km. Beschikbaar vanaf morgen") == ("2014 SL", "Haarlem")


def test_parse_helpers_do_not_confuse_km_or_postcode_with_rooms() -> None:
    assert parse_room_count("2014SL Haarlem - 2Km. Beschikbaar vanaf morgen") is None
    assert parse_area_m2("100 m² 2 A+") == 100


def test_availability_mapping_handles_reserved_and_schema_values() -> None:
    assert detect_availability_status("Verhuurd onder voorbehoud Beschikbaar vanaf 01-07-2026") == (
        "reserved",
        False,
    )
    assert detect_availability_status("Rented from now on") == ("rented", False)
    assert availability_from_schema("https://schema.org/InStock") == ("available", True)

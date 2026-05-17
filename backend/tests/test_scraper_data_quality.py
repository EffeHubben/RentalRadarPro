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
import app.scrapers.funda as funda_scraper
import app.scrapers.generic_sources as generic_scraper
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
    listing = next(item for item in listings if "340-terheijdenstraat" in item.url.lower())

    assert listing.title == "Terheijdenstraat 340, Breda"
    assert listing.image_url == "https://ikwilhuren.nu/media/23/23b9b48ab43e7b7ba6c9d5f4f738c0ab/394x262/thumb.jpg"
    assert listing.price == 1300
    assert listing.area_m2 == 87
    assert listing.rooms == 2
    assert listing.availability_status in {"available", "reserved"}
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


def test_expat_rentals_card_parses_image_price_area_and_rooms(monkeypatch) -> None:
    html = read_fixture("expat_rentals.html")
    config = generic_scraper.GenericSourceConfig(
        source_id="expat_rentals",
        display_name="Expat Rentals NL",
        search_url_template="https://www.expatrentals.eu/country/netherlands/{city}",
        listing_path_markers=("/item/netherlands/",),
    )
    monkeypatch.setattr(generic_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)

    listings = generic_scraper.fetch_generic_source_listings(config, city="Breda")
    listing = next(item for item in listings if "dirk-hartogstraat" in item.url.lower())

    assert listing.title == "Dirk Hartogstraat, Breda"
    assert listing.image_url == "https://pararius-office-prod.global.ssl.fastly.net/10258/files/photos/export/69fc775726f91.jpg?width=600"
    assert listing.price == 1850
    assert listing.area_m2 == 75
    assert listing.rooms == 2
    assert listing.city == "Breda"


def test_heimstaden_card_parses_image_price_area_rooms_and_status(monkeypatch) -> None:
    html = read_fixture("heimstaden.html")
    config = generic_scraper.GenericSourceConfig(
        source_id="heimstaden",
        display_name="Heimstaden",
        search_url_template="https://heimstaden.com/nl/huurwoningen/?text={city}",
        listing_path_markers=("/nl/huurwoningen/",),
    )
    monkeypatch.setattr(generic_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)

    listings = generic_scraper.fetch_generic_source_listings(config, city="Breda")
    listing = next(item for item in listings if "b3a1724b-0ec9-4686-a504-166201fda7d3" in item.url.lower())

    assert listing.title == "Stationslaan 236, Breda"
    assert listing.image_url == "https://heimstaden.com/app/uploads/sites/2/heimstaden-ose/rental-object-attachments/b3a1724b-0ec9-4686-a504-166201fda7d3/md/10-0-5d577f92415014769d2a859b32a3f05f.jpg"
    assert listing.price in {1118, 1180}
    assert listing.area_m2 == 49
    assert listing.rooms == 2
    assert listing.availability_status == "available"


def test_rotsvast_cards_are_not_treated_as_blocked_by_recaptcha_script(monkeypatch) -> None:
    html = """
    <html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body>
      <a class="card card--house" href="https://www.rotsvast.nl/huren/dirk-hartogstraat-breda-h102583057/">
        <img src="https://www.rotsvast.nl/media/home.jpg" />
        <div class="card-house__content">
          <div class="card-house__text">Breda</div>
          <div class="card-house__title">Dirk Hartogstraat</div>
          <ul class="card-house__list">
            <li>77 m²</li>
            <li>2</li>
            <li>Kaal</li>
            <li>Beschikbaar vanaf 01-06-2026</li>
          </ul>
          <div class="card-house__text">€1.750 p.m.</div>
        </div>
      </a>
    </body></html>
    """
    config = generic_scraper.GenericSourceConfig(
        source_id="rotsvast",
        display_name="Rotsvast",
        search_url_template="https://www.rotsvast.nl/huren/?search={city}",
        listing_path_markers=("/huren/",),
    )
    monkeypatch.setattr(generic_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)

    listings = generic_scraper.fetch_generic_source_listings(config, city="Breda")

    assert len(listings) == 1
    assert listings[0].title == "Dirk Hartogstraat, Breda"
    assert listings[0].price == 1750
    assert listings[0].area_m2 == 77
    assert listings[0].rooms == 2


def test_interhouse_current_result_cards_parse_and_filter_requested_city() -> None:
    html = """
    <html><body>
      <a class="c-result-item building-result" href="https://interhouse.nl/vastgoed/huur/breda/woning/viveslaan/">
        <div class="c-result-item__image" style="background-image:url(https://interhouse.nl/home.jpg)"></div>
        <span class="c-result-item__title-type">Woning Te huur</span>
        <span class="c-result-item__title-address">Viveslaan</span>
        <p class="c-result-item__location-label">Breda</p>
        <p class="c-result-item__data-value"><span class="building-status">Beschikbaar</span></p>
        <p class="c-result-item__data-value">Ca. 135 m<sup>2</sup></p>
        <p class="c-result-item__data-value">3</p>
        <p class="c-result-item__price-label">€ 2.250 p/mnd</p>
      </a>
      <a class="c-result-item building-result" href="https://interhouse.nl/vastgoed/huur/haarlem/appartement/example/">
        <span class="c-result-item__title-address">Gedempte Oude Gracht</span>
        <p class="c-result-item__location-label">Haarlem</p>
        <p class="c-result-item__price-label">€ 2.245 p/mnd</p>
      </a>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    config = generic_scraper.GenericSourceConfig(
        source_id="interhouse",
        display_name="Interhouse",
        search_url_template="https://interhouse.nl/huurwoningen/?keyword={city}",
        listing_path_markers=("/vastgoed/huur/",),
    )

    listings = generic_scraper.parse_interhouse_listings(
        soup,
        "https://interhouse.nl/huurwoningen/?keyword=breda",
        "Breda",
        config,
    )

    assert len(listings) == 1
    assert listings[0].title == "Viveslaan, Breda"
    assert listings[0].price == 2250
    assert listings[0].area_m2 == 135
    assert listings[0].rooms == 3
    assert listings[0].image_url == "https://interhouse.nl/home.jpg"


def test_vesteda_listview_card_parses_area_rooms_and_price(monkeypatch) -> None:
    html = """
    <html><body>
      <div class="o-card--listview-container">
        <a href="/nl/huurwoning/rotterdam/wijnbrugstraat-92">
          <article class="o-card o-card--listview o-card--listing">
            <img src="https://images.vesteda.example/woning.jpg" />
            <h3><span class="js--map__summary">Wijnbrugstraat 92</span></h3>
            <span class="js--map__price">€ 1.850</span>
            <span class="js--map__location">Rotterdam</span>
            <span class="js--map__size">84</span>
            <span class="js--map__rooms">2</span>
            <span class="js--map__type">Appartement</span>
          </article>
        </a>
      </div>
    </body></html>
    """
    config = generic_scraper.GenericSourceConfig(
        source_id="vesteda",
        display_name="Vesteda",
        search_url_template="https://www.vesteda.com/nl/woning-zoeken?s={city}&sc=woning",
        listing_path_markers=("/nl/huurwoning",),
    )
    monkeypatch.setattr(generic_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)

    listings = generic_scraper.fetch_generic_source_listings(config, city="Rotterdam")
    assert len(listings) == 1
    listing = listings[0]

    assert listing.title == "Wijnbrugstraat 92, Rotterdam"
    assert listing.price == 1850
    assert listing.area_m2 == 84
    assert listing.rooms == 2
    assert listing.image_url == "https://images.vesteda.example/woning.jpg"


def test_funda_nuxt_payload_supplies_room_counts(monkeypatch) -> None:
    html = read_fixture("funda.html")
    monkeypatch.setattr(funda_scraper, "fetch_page_with_browser", lambda *_args, **_kwargs: html)

    listings = funda_scraper.fetch_funda_listings("Breda")
    listing = next(item for item in listings if "fluitenkruidpad-85" in item.url.lower())

    assert listing.rooms == 3


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
    assert parse_price("1.180 euro/maand") == 1180
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

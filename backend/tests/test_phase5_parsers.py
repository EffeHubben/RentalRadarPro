import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_heimstaden_listings,
    parse_interhouse_listings,
    parse_huislijn_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_heimstaden_listings(generic_config):
    html = """
    <div class="object-card">
        <a class="object-card__inner" href="/nl/huurwoningen/breda/straat-1">
            <div class="object-card__address">Straat 1</div>
            <div class="object-card__location">Breda / Centrum</div>
            <div class="object-card__data-prize">€ 1.250</div>
            <div class="object-card__data-size">60 m2</div>
            <div class="object-card__data-rooms">2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_heimstaden_listings(soup, "https://example.com/nl/huurwoningen", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60
    assert listings[0].rooms == 2

def test_parse_interhouse_listings(generic_config):
    html = """
    <div class="property-item">
        <a href="/huurwoningen/breda/straat-2">
            <h3 class="title">Straat 2</h3>
            <div class="city">Breda</div>
            <div class="price">€ 1.500</div>
            <div class="details">75 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_interhouse_listings(soup, "https://example.com/huurwoningen/breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1500

def test_parse_huislijn_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/huurwoning/breda/straat-3">
            <h3 class="title">Straat 3</h3>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_huislijn_listings(soup, "https://example.com/huurwoning/breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 950

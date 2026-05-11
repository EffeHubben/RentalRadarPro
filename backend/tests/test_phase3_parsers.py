import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_pandomo_listings,
    parse_friendly_housing_listings,
    parse_acasa_listings,
    parse_rentcompany_listings,
    parse_domica_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_pandomo_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/woning/groningen/straat-1">
            <h3 class="title">Straat 1</h3>
            <div class="location">Groningen</div>
            <div class="price">€ 1.250</div>
            <div class="details">60 m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_pandomo_listings(soup, "https://example.com/groningen", "Groningen", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60
    assert listings[0].rooms == 2

def test_parse_friendly_housing_listings(generic_config):
    html = """
    <div class="property-item">
        <a href="/woning/eindhoven/straat-2">
            <h2 class="title">Straat 2</h2>
            <div class="city">Eindhoven</div>
            <div class="price">€ 1.500</div>
            <div class="details">75 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_friendly_housing_listings(soup, "https://example.com/eindhoven", "Eindhoven", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1500

def test_parse_acasa_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/woning/breda/straat-3">
            <h3 class="title">Straat 3</h3>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_acasa_listings(soup, "https://example.com/breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 950

def test_parse_rentcompany_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/woning/rotterdam/straat-4">
            <h3 class="title">Straat 4</h3>
            <div class="price">€ 1.100</div>
            <div class="details">55m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_rentcompany_listings(soup, "https://example.com/rotterdam", "Rotterdam", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1100

def test_parse_domica_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/woning/amsterdam/straat-5">
            <h3 class="title">Straat 5</h3>
            <div class="price">€ 1.800</div>
            <div class="details">70 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_domica_listings(soup, "https://example.com/amsterdam", "Amsterdam", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1800

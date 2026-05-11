import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_liv_residential_listings,
    parse_bwhousing_listings,
    parse_tvn_real_estate_listings,
    parse_maxx_aanhuur_listings,
    parse_vbt_verhuurmakelaars_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_liv_residential_listings(generic_config):
    html = """
    <div class="property-item">
        <a href="/woningen/amsterdam/straat-1">
            <h3 class="title">Straat 1</h3>
            <div class="location">Amsterdam</div>
            <div class="price">€ 1.250</div>
            <div class="details">60 m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_liv_residential_listings(soup, "https://example.com/amsterdam", "Amsterdam", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60

def test_parse_bwhousing_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/rent-property/den-haag/straat-2">
            <h3 class="title">Straat 2</h3>
            <div class="price">€ 1.500</div>
            <div class="details">75 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_bwhousing_listings(soup, "https://example.com/den-haag", "Den Haag", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1500

def test_parse_tvn_real_estate_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/en/for-rent/rotterdam/straat-3">
            <h3 class="title">Straat 3</h3>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_tvn_real_estate_listings(soup, "https://example.com/rotterdam", "Rotterdam", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 950

def test_parse_maxx_aanhuur_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/woningaanbod/utrecht/straat-4">
            <h3 class="title">Straat 4</h3>
            <div class="price">€ 1.100</div>
            <div class="details">55m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_maxx_aanhuur_listings(soup, "https://example.com/utrecht", "Utrecht", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1100

def test_parse_vbt_verhuurmakelaars_listings(generic_config):
    html = """
    <div class="property-card">
        <a href="/aanbod/breda/straat-5">
            <h3 class="title">Straat 5</h3>
            <div class="price">€ 1.800</div>
            <div class="details">70 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_vbt_verhuurmakelaars_listings(soup, "https://example.com/breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1800

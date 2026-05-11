import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_maxx_aanhuur_listings,
    parse_friendly_housing_listings,
    parse_ymere_huur_listings,
    parse_duwo_listings,
    parse_xior_listings,
    parse_sshxl_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_maxx_aanhuur_listings(generic_config):
    html = """
    <div class="aanbod-item">
        <a href="/aanbod/groningen/straat-1">
            <h2 class="title">Straat 1</h2>
            <div class="price">€ 1.250</div>
            <div class="details">60 m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_maxx_aanhuur_listings(soup, "https://example.com/groningen", "Groningen", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1250

def test_parse_friendly_housing_listings(generic_config):
    html = """
    <div class="property-item">
        <a href="/aanbod/eindhoven/straat-2">
            <h2 class="title">Straat 2</h2>
            <div class="price">€ 1.500</div>
            <div class="details">75 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_friendly_housing_listings(soup, "https://example.com/eindhoven", "Eindhoven", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1500

def test_parse_ymere_huur_listings(generic_config):
    html = """
    <div class="aanbod-item">
        <a href="/aanbod/amsterdam/straat-3">
            <h3 class="title">Straat 3</h3>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_ymere_huur_listings(soup, "https://example.com/amsterdam", "Amsterdam", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 950

def test_parse_duwo_listings(generic_config):
    html = """
    <div class="residence">
        <a href="/woning/delft/straat-4">
            <h3 class="title">Straat 4</h3>
            <div class="price">€ 600</div>
            <div class="details">20 m2, 1 kamer</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_duwo_listings(soup, "https://example.com/delft", "Delft", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 600

def test_parse_xior_listings(generic_config):
    html = """
    <div class="residence-card">
        <a href="/aanbod/utrecht/straat-5">
            <h3 class="title">Straat 5</h3>
            <div class="price">€ 850</div>
            <div class="details">25 m2</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_xior_listings(soup, "https://example.com/utrecht", "Utrecht", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 850

def test_parse_sshxl_listings(generic_config):
    html = """
    <div class="residence">
        <a href="/listings/utrecht/straat-6">
            <h3 class="title">Straat 6</h3>
            <div class="price">€ 450</div>
            <div class="details">15 m2, 1 kamer</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_sshxl_listings(soup, "https://example.com/utrecht", "Utrecht", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 450

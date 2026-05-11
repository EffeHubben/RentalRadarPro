import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_123wonen_listings,
    parse_nederwoon_listings,
    parse_rotsvast_listings,
    parse_househunting_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_123wonen_listings(generic_config):
    html = """
    <div class="woning-listing">
        <a href="/huurwoningen/breda/straat-1">
            <h2 class="woning-title">Straat 1</h2>
            <div class="woning-prijs">€ 1.250,-</div>
            <div class="woning-omschrijving">Appartement van 60m2 met 2 kamers in Breda.</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_123wonen_listings(soup, "https://example.com/breda", "Breda", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60
    assert listings[0].rooms == 2
    assert "Straat 1" in listings[0].title

def test_parse_nederwoon_listings(generic_config):
    html = """
    <div class="aanbod-item">
        <a href="/aanbod/utrecht/straat-2">
            <h3 class="aanbod-item-title">Straat 2, Utrecht</h3>
            <div class="aanbod-item-price">€ 1.500 p/m</div>
            <div class="details">Woonoppervlakte: 75 m² | Kamers: 3</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_nederwoon_listings(soup, "https://example.com/utrecht", "Utrecht", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1500
    assert listings[0].area_m2 == 75
    assert listings[0].rooms == 3
    assert "Straat 2" in listings[0].title

def test_parse_rotsvast_listings(generic_config):
    html = """
    <div class="rotsvast-listing-item">
        <a href="/huren/breda/straat-3">
            <h3 class="address">Straat 3</h3>
            <div class="city">Breda</div>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_rotsvast_listings(soup, "https://example.com/breda", "Breda", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 950
    assert listings[0].area_m2 == 50
    assert listings[0].rooms == 2

def test_parse_househunting_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/woning/eindhoven/straat-4">
            <h2 class="title">Straat 4</h2>
            <div class="location">Eindhoven</div>
            <div class="price">€ 1.100</div>
            <div class="details">Oppervlakte: 55m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_househunting_listings(soup, "https://example.com/eindhoven", "Eindhoven", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1100
    assert listings[0].area_m2 == 55
    assert listings[0].rooms == 2

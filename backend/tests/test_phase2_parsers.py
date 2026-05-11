import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_huurwoningen_listings,
    parse_directwonen_listings,
    parse_huurportaal_listings,
    parse_huurwoningportaal_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_huurwoningen_listings(generic_config):
    html = """
    <div class="listing-search-item">
        <a href="/in/breda/straat-1">
            <h2 class="listing-search-item__title">Straat 1</h2>
            <div class="listing-search-item__sub-title">Straat 1, 4811 AB Breda</div>
            <div class="listing-search-item__price">€ 1.250</div>
            <div class="details">60 m2 • 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_huurwoningen_listings(soup, "https://example.com/in/breda", "Breda", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60
    assert listings[0].rooms == 2
    assert "Straat 1" in listings[0].title

def test_parse_directwonen_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/huurwoning/utrecht/straat-2">
            <h2 class="title">Straat 2</h2>
            <div class="city">Utrecht</div>
            <div class="price">€ 1.500</div>
            <div class="details">75 m2, 3 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_directwonen_listings(soup, "https://example.com/huurwoning/utrecht", "Utrecht", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1500
    assert listings[0].area_m2 == 75
    assert listings[0].rooms == 3

def test_parse_huurportaal_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/huurwoning/breda/straat-3">
            <h3 class="title">Straat 3</h3>
            <div class="location">Breda</div>
            <div class="price">€ 950</div>
            <div class="details">50 m2 - 2 slaapkamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_huurportaal_listings(soup, "https://example.com/huurwoning/breda", "Breda", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 950
    assert listings[0].area_m2 == 50
    assert listings[0].rooms == 2

def test_parse_huurwoningportaal_listings(generic_config):
    html = """
    <div class="property-item">
        <a href="/huurwoningen/eindhoven/straat-4">
            <h3 class="title">Straat 4</h3>
            <div class="city">Eindhoven</div>
            <div class="price">€ 1.100</div>
            <div class="details">Oppervlakte: 55m2, 2 kamers</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_huurwoningportaal_listings(soup, "https://example.com/huurwoningen/eindhoven", "Eindhoven", generic_config)
    
    assert len(listings) == 1
    assert listings[0].price == 1100
    assert listings[0].area_m2 == 55
    assert listings[0].rooms == 2

import pytest
from bs4 import BeautifulSoup
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    parse_pararius_listings,
    parse_kamernet_listings,
)

@pytest.fixture
def generic_config():
    return GenericSourceConfig(
        source_id="test",
        display_name="Test Source",
        search_url_template="https://example.com/{city}",
        listing_path_markers=("/listing/",),
    )

def test_parse_pararius_listings(generic_config):
    html = """
    <section class="listing-search-item">
        <a href="/appartement-te-huur/breda/straat-1">
            <h2 class="listing-search-item__title">Straat 1</h2>
            <div class="listing-search-item__sub-title">4811 AB Breda</div>
            <div class="listing-search-item__price">€ 1.250</div>
            <div class="listing-search-item__features">
                <ul>
                    <li>60 m2</li>
                    <li>2 kamers</li>
                </ul>
            </div>
        </a>
    </section>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_pararius_listings(soup, "https://example.com/huurwoningen/breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 1250
    assert listings[0].area_m2 == 60
    assert listings[0].rooms == 2

def test_parse_kamernet_listings(generic_config):
    html = """
    <div class="listing-item">
        <a href="/huren/kamer-breda/straat-2">
            <h3 class="title">Straat 2</h3>
            <div class="price">€ 500</div>
            <div class="details">15 m2, 1 kamer</div>
        </a>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")
    listings = parse_kamernet_listings(soup, "https://example.com/huren/kamer-breda", "Breda", generic_config)
    assert len(listings) == 1
    assert listings[0].price == 500
    assert listings[0].area_m2 == 15
    assert listings[0].rooms == 1

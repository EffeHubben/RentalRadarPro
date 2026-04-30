from dataclasses import dataclass
from urllib.parse import quote
from typing import Callable

from app.scrapers.funda import fetch_funda_listings
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    fetch_generic_source_listings,
)
from app.scrapers.ikwilhuren import fetch_ikwilhuren_listings
from app.scrapers.marktplaats import fetch_marktplaats_listings


FetchListings = Callable[[str], list]


@dataclass(frozen=True)
class RentalSource:
    source_id: str
    display_name: str
    enabled: bool
    supports_city_search: bool
    base_url: str
    notes: str
    fetch_listings: FetchListings
    manual_search_url_template: str | None = None
    default_enabled_for_auto_scan: bool = False
    supports_automatic_scraping: bool = True
    status_note_nl: str | None = None
    status_note_en: str | None = None

    def manual_search_url(self, city: str | None = None) -> str | None:
        if not self.manual_search_url_template:
            return None

        normalized_city = quote("-".join((city or "").lower().split()))
        if not normalized_city:
            return None

        return self.manual_search_url_template.format(city=normalized_city)


def generic_fetcher(config: GenericSourceConfig) -> FetchListings:
    return lambda city: fetch_generic_source_listings(config, city=city)


RENTAL_SOURCES: list[RentalSource] = [
    RentalSource(
        source_id="marktplaats",
        display_name="Marktplaats",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.marktplaats.nl",
        notes="Existing broad Marktplaats rental search.",
        fetch_listings=fetch_marktplaats_listings,
        manual_search_url_template="https://www.marktplaats.nl/q/{city}+huurwoning/",
        default_enabled_for_auto_scan=True,
    ),
    RentalSource(
        source_id="funda",
        display_name="Funda",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.funda.nl",
        notes="Existing Funda rental search.",
        fetch_listings=fetch_funda_listings,
        manual_search_url_template="https://www.funda.nl/zoeken/huur/?selected_area=%5B%22{city}%22%5D",
        default_enabled_for_auto_scan=True,
    ),
    RentalSource(
        source_id="ikwilhuren",
        display_name="Ik wil huren",
        enabled=True,
        supports_city_search=True,
        base_url="https://ikwilhuren.nu",
        notes="Existing MVGM/Ik wil huren search.",
        fetch_listings=fetch_ikwilhuren_listings,
        manual_search_url_template="https://ikwilhuren.nu/aanbod?gemeente={city}",
        default_enabled_for_auto_scan=True,
    ),
    RentalSource(
        source_id="pararius",
        display_name="Pararius",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.pararius.nl",
        notes="Generic public city listing parser; may be blocked by bot protection.",
        manual_search_url_template="https://www.pararius.nl/huurwoningen/{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: kan automatische verzoeken blokkeren.",
        status_note_en="Limited: may block automated requests.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="pararius",
                display_name="Pararius",
                search_url_template="https://www.pararius.nl/huurwoningen/{city}",
                listing_path_markers=("/appartement-te-huur/", "/huis-te-huur/", "/kamer-te-huur/"),
            )
        ),
    ),
    RentalSource(
        source_id="huurwoningen",
        display_name="Huurwoningen.nl",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huurwoningen.nl",
        notes="Generic public city listing parser.",
        manual_search_url_template="https://www.huurwoningen.nl/in/{city}/",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: werkt meestal beter handmatig.",
        status_note_en="Limited: usually works better manually.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="huurwoningen",
                display_name="Huurwoningen.nl",
                search_url_template="https://www.huurwoningen.nl/in/{city}/",
                listing_path_markers=("/huur/", "/in/"),
            )
        ),
    ),
    RentalSource(
        source_id="kamernet",
        display_name="Kamernet",
        enabled=True,
        supports_city_search=True,
        base_url="https://kamernet.nl",
        notes="Generic public city search; many details may require account access.",
        manual_search_url_template="https://kamernet.nl/huren/kamer-{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: details kunnen accounttoegang vereisen.",
        status_note_en="Limited: details may require account access.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="kamernet",
                display_name="Kamernet",
                search_url_template="https://kamernet.nl/huren/kamer-{city}",
                listing_path_markers=("/huren/", "/kamer-", "/studio-", "/appartement-"),
                blocked_markers=("log in", "sign in"),
            )
        ),
    ),
    RentalSource(
        source_id="rentola",
        display_name="Rentola",
        enabled=True,
        supports_city_search=True,
        base_url="https://rentola.nl",
        notes="Generic public city listing parser; may present paywall or login prompts.",
        manual_search_url_template="https://rentola.nl/huurwoningen/{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: kan login- of betaalmuren tonen.",
        status_note_en="Limited: may show login or paywall prompts.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="rentola",
                display_name="Rentola",
                search_url_template="https://rentola.nl/huurwoningen/{city}",
                listing_path_markers=("/huurwoningen/", "/woning/", "/appartement/"),
            )
        ),
    ),
    RentalSource(
        source_id="huurportaal",
        display_name="Huurportaal",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huurportaal.nl",
        notes="Generic public city listing parser.",
        manual_search_url_template="https://www.huurportaal.nl/huurwoningen/{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: kan automatische verzoeken blokkeren.",
        status_note_en="Limited: may block automated requests.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="huurportaal",
                display_name="Huurportaal",
                search_url_template="https://www.huurportaal.nl/huurwoningen/{city}",
                listing_path_markers=("/huurwoning/", "/huurwoningen/", "/woning/"),
            )
        ),
    ),
    RentalSource(
        source_id="directwonen",
        display_name="Direct Wonen",
        enabled=True,
        supports_city_search=True,
        base_url="https://directwonen.nl",
        notes="Generic public city listing parser.",
        manual_search_url_template="https://directwonen.nl/huurwoningen-huren/{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: handmatig openen blijft beschikbaar.",
        status_note_en="Limited: manual opening remains available.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="directwonen",
                display_name="Direct Wonen",
                search_url_template="https://directwonen.nl/huurwoningen-huren/{city}",
                listing_path_markers=("/huurwoningen-huren/", "/huurwoning/"),
            )
        ),
    ),
    RentalSource(
        source_id="huislijn",
        display_name="Huislijn",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huislijn.nl",
        notes="Generic public rental search parser.",
        manual_search_url_template="https://www.huislijn.nl/huurwoning/nederland/{city}",
        supports_automatic_scraping=False,
        status_note_nl="Beperkt: zoekpagina's kunnen per stad verschillen.",
        status_note_en="Limited: city search pages may vary.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="huislijn",
                display_name="Huislijn",
                search_url_template="https://www.huislijn.nl/huurwoning/nederland/{city}",
                listing_path_markers=("/huurwoning/", "/woning/"),
            )
        ),
    ),
]


LAST_SOURCE_RUNS: dict[str, dict] = {}


def enabled_sources(source_ids: list[str] | None = None) -> list[RentalSource]:
    if source_ids is None:
        return [source for source in RENTAL_SOURCES if source.enabled]

    selected_ids = set(source_ids)
    return [
        source
        for source in RENTAL_SOURCES
        if source.enabled and source.source_id in selected_ids
    ]


def source_payload(source: RentalSource, city: str | None = None) -> dict:
    return {
        "source_id": source.source_id,
        "display_name": source.display_name,
        "enabled": source.enabled,
        "supports_city_search": source.supports_city_search,
        "base_url": source.base_url,
        "notes": source.notes,
        "manual_search_url_template": source.manual_search_url_template,
        "manual_search_url": source.manual_search_url(city),
        "default_enabled_for_auto_scan": source.default_enabled_for_auto_scan,
        "supports_automatic_scraping": source.supports_automatic_scraping,
        "status_note_nl": source.status_note_nl,
        "status_note_en": source.status_note_en,
        "last_run": LAST_SOURCE_RUNS.get(source.source_id),
    }

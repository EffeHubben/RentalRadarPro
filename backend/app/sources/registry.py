from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
from urllib.parse import quote
from typing import Callable

from app.core.config import settings
from app.scrapers.funda import fetch_funda_listings
from app.scrapers.generic_sources import (
    GenericSourceConfig,
    fetch_generic_source_listings,
)
from app.scrapers.ikwilhuren import fetch_ikwilhuren_listings
from app.scrapers.marktplaats import fetch_marktplaats_listings


FetchListings = Callable[[str], list]


@dataclass
class RentalSource:
    source_key: str
    display_name: str
    enabled: bool
    supports_city_search: bool
    base_url: str
    notes: str
    fetch_listings: FetchListings
    category: str = "marketplace"
    manual_search_url_template: str | None = None
    auto_scan_enabled: bool = False
    scan_interval_minutes: int | None = None
    status: str = "manual"
    internal_reason: str | None = None
    max_timeout_seconds: int | None = None
    failure_count: int = 0
    last_scan_started_at: datetime | None = None
    last_scan_finished_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    listings_found_last_scan: int = 0
    supports_automatic_scraping: bool = True
    status_note_nl: str | None = None
    status_note_en: str | None = None

    @property
    def source_id(self) -> str:
        return self.source_key

    @property
    def default_enabled_for_auto_scan(self) -> bool:
        return self.auto_scan_enabled

    @property
    def interval_minutes(self) -> int:
        return self.scan_interval_minutes or settings.listing_scan_interval_minutes

    @property
    def timeout_seconds(self) -> int:
        return self.max_timeout_seconds or settings.listing_source_timeout_seconds

    def stagger_seconds(self) -> int:
        digest = hashlib.sha1(self.source_key.encode("utf-8")).hexdigest()
        return int(digest[:4], 16) % max(60, self.interval_minutes * 60)

    def next_due_at(self) -> datetime | None:
        if not self.auto_scan_enabled:
            return None

        if self.last_scan_finished_at is None:
            return None

        backoff_minutes = 0
        if self.failure_count:
            backoff_minutes = min(240, self.interval_minutes * (2 ** min(self.failure_count, 5)))

        interval = max(self.interval_minutes, backoff_minutes)
        return self.last_scan_finished_at + timedelta(minutes=interval, seconds=self.stagger_seconds())

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
        source_key="marktplaats",
        display_name="Marktplaats",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.marktplaats.nl",
        notes="Existing broad Marktplaats rental search.",
        fetch_listings=fetch_marktplaats_listings,
        manual_search_url_template="https://www.marktplaats.nl/q/{city}+huurwoning/",
        category="marketplace",
        auto_scan_enabled=True,
        scan_interval_minutes=5,
        status="online",
    ),
    RentalSource(
        source_key="funda",
        display_name="Funda",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.funda.nl",
        notes="Existing Funda rental search.",
        fetch_listings=fetch_funda_listings,
        manual_search_url_template="https://www.funda.nl/zoeken/huur/?selected_area=%5B%22{city}%22%5D",
        category="marketplace",
        auto_scan_enabled=True,
        scan_interval_minutes=5,
        status="online",
    ),
    RentalSource(
        source_key="ikwilhuren",
        display_name="Ik wil huren",
        enabled=True,
        supports_city_search=True,
        base_url="https://ikwilhuren.nu",
        notes="Existing MVGM/Ik wil huren search.",
        fetch_listings=fetch_ikwilhuren_listings,
        manual_search_url_template="https://ikwilhuren.nu/aanbod?gemeente={city}",
        category="landlord",
        auto_scan_enabled=True,
        scan_interval_minutes=5,
        status="online",
    ),
    RentalSource(
        source_key="pararius",
        display_name="Pararius",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.pararius.nl",
        notes="Generic public city listing parser; may be blocked by bot protection.",
        category="marketplace",
        manual_search_url_template="https://www.pararius.nl/huurwoningen/{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public listings exist, but automated requests are frequently blocked by bot protection.",
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
        source_key="huurwoningen",
        display_name="Huurwoningen.nl",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huurwoningen.nl",
        notes="Generic public city listing parser.",
        category="marketplace",
        manual_search_url_template="https://www.huurwoningen.nl/in/{city}/",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public pages exist, but reliable automated parsing is limited and often better handled manually.",
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
        source_key="kamernet",
        display_name="Kamernet",
        enabled=True,
        supports_city_search=True,
        base_url="https://kamernet.nl",
        notes="Generic public city search; many details may require account access.",
        category="marketplace",
        manual_search_url_template="https://kamernet.nl/huren/kamer-{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Many details and interactions require account access; do not scrape private/account-only content.",
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
        source_key="rentola",
        display_name="Rentola",
        enabled=True,
        supports_city_search=True,
        base_url="https://rentola.nl",
        notes="Generic public city listing parser; may present paywall or login prompts.",
        category="aggregator",
        manual_search_url_template="https://rentola.nl/huurwoningen/{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="May show login/paywall prompts and is not reliable for unattended public scans.",
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
        source_key="huurportaal",
        display_name="Huurportaal",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huurportaal.nl",
        notes="Generic public city listing parser.",
        category="aggregator",
        manual_search_url_template="https://www.huurportaal.nl/huurwoningen/{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public pages may block automated requests; keep manual until reliability is proven.",
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
        source_key="directwonen",
        display_name="Direct Wonen",
        enabled=True,
        supports_city_search=True,
        base_url="https://directwonen.nl",
        notes="Generic public city listing parser.",
        category="marketplace",
        manual_search_url_template="https://directwonen.nl/huurwoningen-huren/{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public search exists, but automatic parsing is not yet reliable enough.",
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
        source_key="huislijn",
        display_name="Huislijn",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huislijn.nl",
        notes="Generic public rental search parser.",
        category="aggregator",
        manual_search_url_template="https://www.huislijn.nl/huurwoning/nederland/{city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="City pages vary and need further validation before unattended scanning.",
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
    RentalSource(
        source_key="heimstaden",
        display_name="Heimstaden",
        enabled=True,
        supports_city_search=True,
        base_url="https://heimstaden.com",
        notes="Public Dutch rental listing page.",
        category="landlord",
        manual_search_url_template="https://heimstaden.com/nl/huurwoningen/?text={city}",
        auto_scan_enabled=True,
        scan_interval_minutes=15,
        status="online",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="heimstaden",
                display_name="Heimstaden",
                search_url_template="https://heimstaden.com/nl/huurwoningen/?text={city}",
                listing_path_markers=("/nl/huurwoningen/", "/nl/projecten/"),
            )
        ),
    ),
    RentalSource(
        source_key="rotsvast",
        display_name="Rotsvast",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.rotsvast.nl",
        notes="Public rental listing page.",
        category="marketplace",
        manual_search_url_template="https://www.rotsvast.nl/huren/?search={city}",
        auto_scan_enabled=True,
        scan_interval_minutes=15,
        status="online",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="rotsvast",
                display_name="Rotsvast",
                search_url_template="https://www.rotsvast.nl/huren/?search={city}",
                listing_path_markers=("/huren/", "/woning/", "/appartement/"),
            )
        ),
    ),
    RentalSource(
        source_key="interhouse",
        display_name="Interhouse",
        enabled=True,
        supports_city_search=True,
        base_url="https://interhouse.nl",
        notes="Public rental listing page; dynamic results may be incomplete.",
        category="marketplace",
        manual_search_url_template="https://interhouse.nl/huurwoningen/?keyword={city}",
        auto_scan_enabled=True,
        scan_interval_minutes=15,
        status="degraded",
        internal_reason="Public listings exist, but the results UI is dynamic; monitor scan quality.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="interhouse",
                display_name="Interhouse",
                search_url_template="https://interhouse.nl/huurwoningen/?keyword={city}",
                listing_path_markers=("/huurwoningen/", "/woning/"),
            )
        ),
    ),
    RentalSource(
        source_key="maxx_aanhuur",
        display_name="Maxx Aanhuur",
        enabled=True,
        supports_city_search=True,
        base_url="https://maxx-rental.com",
        notes="Public listing page with dynamic results.",
        category="marketplace",
        manual_search_url_template="https://maxx-rental.com/woningaanbod/?location={city}",
        auto_scan_enabled=True,
        scan_interval_minutes=15,
        status="degraded",
        internal_reason="Public offer is visible, but the result loader can fail; monitor before promoting to stable.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="maxx_aanhuur",
                display_name="Maxx Aanhuur",
                search_url_template="https://maxx-rental.com/woningaanbod/?location={city}",
                listing_path_markers=("/woningaanbod/", "/aanbod/", "/huurwoning/"),
            )
        ),
    ),
    RentalSource(
        source_key="vesteda",
        display_name="Vesteda",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.vesteda.com",
        notes="Public offer page, but listing details require more validation.",
        category="landlord",
        manual_search_url_template="https://www.vesteda.com/aanbod?place={city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public offer page exists, but reliable listing extraction was not confirmed.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="vesteda",
                display_name="Vesteda",
                search_url_template="https://www.vesteda.com/aanbod?place={city}",
                listing_path_markers=("/aanbod/", "/woning/"),
            )
        ),
    ),
    RentalSource(
        source_key="holland2stay",
        display_name="Holland2Stay",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.holland2stay.com",
        notes="Public site, booking availability appears app-driven.",
        category="landlord",
        manual_search_url_template="https://www.holland2stay.com/residences?city={city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Availability is app-driven and needs endpoint validation; do not scrape account/booking flows.",
        fetch_listings=generic_fetcher(
            GenericSourceConfig(
                source_id="holland2stay",
                display_name="Holland2Stay",
                search_url_template="https://www.holland2stay.com/residences?city={city}",
                listing_path_markers=("/residences/", "/residence/"),
            )
        ),
    ),
    RentalSource(
        source_key="huren_in_holland_rijnland",
        display_name="Huren in Holland Rijnland",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.hureninhollandrijnland.nl",
        notes="Regional housing-corporation portal.",
        category="housing-corporation",
        manual_search_url_template="https://www.hureninhollandrijnland.nl/aanbod",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Responding/passend aanbod depends on registration and household data; keep manual.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="thuispoort",
        display_name="Thuispoort",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.thuispoort.nl",
        notes="Regional housing-corporation portal.",
        category="housing-corporation",
        manual_search_url_template="https://www.thuispoort.nl/aanbod",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Passend aanbod and responding require registration/income context; keep manual.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="woninghuren",
        display_name="WoningHuren.nl",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.woninghuren.nl",
        notes="Regional housing-corporation portal.",
        category="housing-corporation",
        manual_search_url_template="https://www.woninghuren.nl/app/onboarding-1/passend-aanbod",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Passend aanbod and responding require account/income context; keep manual.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="woning_in_zicht",
        display_name="Woning in Zicht",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.woninginzicht.nl",
        notes="Regional housing-corporation portal.",
        category="housing-corporation",
        manual_search_url_template="https://www.woninginzicht.nl/aanbod",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Social housing portal; likely account/passend aanbod flow.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="nmg_wonen",
        display_name="NMG Wonen",
        enabled=True,
        supports_city_search=True,
        base_url="https://nmgwonen.nl",
        notes="Public site; current rent offer needs more endpoint validation.",
        category="marketplace",
        manual_search_url_template="https://nmgwonen.nl/huur/",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public rent info exists, but stable listing pages were not confirmed.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="woonhave",
        display_name="Woonhave / Wonen.nu",
        enabled=True,
        supports_city_search=True,
        base_url="https://wonen.nu",
        notes="Woonhave offer is published via Wonen.nu.",
        category="landlord",
        manual_search_url_template="https://wonen.nu/woningen?plaats={city}",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="limited",
        internal_reason="Public platform exists, but listing endpoint needs validation before automatic scans.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="woonzorg_nederland",
        display_name="Woonzorg Nederland",
        enabled=True,
        supports_city_search=True,
        base_url="https://woningaanbod.woonzorg.nl",
        notes="Senior housing offer; some listings via local portals.",
        category="housing-corporation",
        manual_search_url_template="https://woningaanbod.woonzorg.nl/",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Partly redirects to local portals and registration flows; senior-housing relevance is narrower.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="huurstunt",
        display_name="Huurstunt",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.huurstunt.nl",
        notes="Paid aggregator/match service.",
        category="aggregator",
        manual_search_url_template="https://www.huurstunt.nl/",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Paid match service; do not scrape premium/account-only listings.",
        fetch_listings=lambda city: [],
    ),
    RentalSource(
        source_key="stekkies",
        display_name="Stekkies",
        enabled=True,
        supports_city_search=True,
        base_url="https://www.stekkies.com",
        notes="Paid aggregator/match service.",
        category="aggregator",
        manual_search_url_template="https://www.stekkies.com/nl/zoeken",
        auto_scan_enabled=False,
        supports_automatic_scraping=False,
        status="manual",
        internal_reason="Paid search service; do not scrape account-only matches.",
        fetch_listings=lambda city: [],
    ),
]


LAST_SOURCE_RUNS: dict[str, dict] = {}


def enabled_sources(source_ids: list[str] | None = None, auto_only: bool = False) -> list[RentalSource]:
    if source_ids is None:
        return [
            source
            for source in RENTAL_SOURCES
            if source.enabled and (not auto_only or source.auto_scan_enabled)
        ]

    selected_ids = set(source_ids)
    return [
        source
        for source in RENTAL_SOURCES
        if source.enabled
        and source.source_id in selected_ids
        and (not auto_only or source.auto_scan_enabled)
    ]


def source_payload(source: RentalSource, city: str | None = None) -> dict:
    next_due_at = source.next_due_at()
    return {
        "source_id": source.source_key,
        "source_key": source.source_key,
        "display_name": source.display_name,
        "enabled": source.enabled,
        "supports_city_search": source.supports_city_search,
        "base_url": source.base_url,
        "category": source.category,
        "notes": source.notes,
        "internal_reason": source.internal_reason,
        "manual_search_url_template": source.manual_search_url_template,
        "manual_search_url": source.manual_search_url(city),
        "default_enabled_for_auto_scan": source.default_enabled_for_auto_scan,
        "auto_scan_enabled": source.auto_scan_enabled,
        "scan_interval_minutes": source.interval_minutes,
        "max_timeout_seconds": source.timeout_seconds,
        "status": source.status,
        "last_scan_started_at": source.last_scan_started_at.isoformat() if source.last_scan_started_at else None,
        "last_scan_finished_at": source.last_scan_finished_at.isoformat() if source.last_scan_finished_at else None,
        "last_success_at": source.last_success_at.isoformat() if source.last_success_at else None,
        "last_error": source.last_error,
        "last_failed_at": None,
        "last_failed_error": None,
        "listings_found_last_scan": source.listings_found_last_scan,
        "total_listing_count": 0,
        "active_listing_count": 0,
        "failure_count": source.failure_count,
        "next_due_at": next_due_at.isoformat() if next_due_at else None,
        "supports_automatic_scraping": source.supports_automatic_scraping,
        "status_note_nl": source.status_note_nl,
        "status_note_en": source.status_note_en,
        "last_run": LAST_SOURCE_RUNS.get(source.source_id),
    }

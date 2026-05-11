"""Tests for the search-engine upgrade: registry capability flags, listing
quality with source reliability, fallback duplicate keys, listing-API
multi-city/source filters, and city normalisation."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-search-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-search-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.api.listings import _diversify_best_match_listings, _listing_quality_score
from app.database.db import SessionLocal, create_database_tables
from app.main import app
from app.models.listing import Listing
from app.services.duplicates import (
    assign_duplicate_metadata,
    build_duplicate_key,
    normalize_title_signature,
)
from app.services.listing_quality import (
    ListingQualityInput,
    build_listing_quality,
    calculate_confidence_score,
)
from app.services.scanner_reliability import normalize_city
from app.sources.registry import RENTAL_SOURCES, source_payload


create_database_tables()
client = TestClient(app)


def reset_listings() -> None:
    database = SessionLocal()
    try:
        database.query(Listing).delete()
        database.commit()
    finally:
        database.close()


def test_registry_has_capability_metadata_for_every_source() -> None:
    for source in RENTAL_SOURCES:
        payload = source_payload(source)

        assert payload["country"] == "NL"
        assert payload["source_type"] in {
            "direct_scraper",
            "generic_html",
            "manual",
            "rss",
            "sitemap",
            "partner",
            "api",
        }
        assert isinstance(payload["supports_pagination"], bool)
        assert isinstance(payload["requires_detail_page"], bool)
        assert isinstance(payload["likely_blocks_bots"], bool)
        assert isinstance(payload["requires_login"], bool)
        assert isinstance(payload["supports_price_filter"], bool)
        assert isinstance(payload["supports_property_type"], bool)
        assert 0 <= payload["reliability_weight"] <= 1


def test_registry_marks_only_validated_sources_as_auto_scan() -> None:
    auto_keys = {source.source_key for source in RENTAL_SOURCES if source.auto_scan_enabled}

    expected_known_working = {
        "funda",
        "ikwilhuren",
        "heimstaden",
        "rotsvast",
        "interhouse",
        "maxx_aanhuur",
        "vesteda",
        "expat_rentals",
    }

    assert expected_known_working.issubset(auto_keys), (
        f"missing known working sources: {expected_known_working - auto_keys}"
    )

    for source in RENTAL_SOURCES:
        if not source.auto_scan_enabled:
            continue
        assert source.source_type in {"direct_scraper", "generic_html", "api"}
        assert source.supports_automatic_scraping is True
        assert source.status in {"online", "degraded"}


def test_registry_contains_expanded_external_sources_without_auto_enabling_them() -> None:
    external_keys = {
        "woonnet_rijnmond",
        "klikvoorwonen",
        "wooniezie",
        "entree",
        "room_university_housing",
        "plaza_newnewnew",
        "woonnet_haaglanden",
        "liv_residential",
        "housinganywhere",
    }
    registry_by_key = {source.source_key: source for source in RENTAL_SOURCES}

    assert external_keys.issubset(registry_by_key)
    assert all(not registry_by_key[key].auto_scan_enabled for key in external_keys)
    assert registry_by_key["klikvoorwonen"].supported_cities
    assert registry_by_key["klikvoorwonen"].requires_login is True


def test_listing_quality_applies_source_reliability_weight() -> None:
    base = ListingQualityInput(
        title="Sunny apartment near centre",
        description="A bright, modern apartment in the city centre",
        url="https://example.com/listing/123",
        requested_city="Breda",
        scraped_city="Breda",
        price=1450,
        area_m2=55,
        image_url="https://example.com/image.jpg",
        source_reliability_weight=0.5,
    )
    high = ListingQualityInput(
        title=base.title,
        description=base.description,
        url=base.url,
        requested_city=base.requested_city,
        scraped_city=base.scraped_city,
        price=base.price,
        area_m2=base.area_m2,
        image_url=base.image_url,
        source_reliability_weight=0.9,
    )

    base_quality = build_listing_quality(base)["confidence_score"]
    high_quality = build_listing_quality(high)["confidence_score"]

    assert high_quality > base_quality, (base_quality, high_quality)


def test_calculate_confidence_score_penalises_low_reliability_sources() -> None:
    common = dict(
        title="Compact studio",
        city="Breda",
        property_type="studio",
        price=1100,
        area_m2=28,
        image_url="https://example.com/image.jpg",
        private_kitchen=True,
        private_bathroom=True,
        private_toilet=True,
        is_shared=False,
        is_woningruil=False,
        availability_status="available",
    )
    high = calculate_confidence_score(**common, source_reliability_weight=0.9)
    low = calculate_confidence_score(**common, source_reliability_weight=0.3)

    assert high - low >= 0.05


def test_normalize_title_signature_drops_noise_tokens() -> None:
    signature = normalize_title_signature("Te huur: appartement bij centrum Breda")

    assert "te" not in signature.split("-")
    assert "huur" not in signature.split("-")
    assert "appartement" not in signature.split("-")
    assert "centrum" in signature.split("-")
    assert "breda" in signature.split("-")


def test_build_duplicate_key_falls_back_to_title_signature_when_address_missing() -> None:
    listing = Listing(
        title="Kasteelplein appartement met balkon",
        source="Funda",
        url="https://example.com/listing/abc",
        city="Breda",
        price=1400,
        area_m2=55,
        rooms=2,
    )

    duplicate_key = build_duplicate_key(listing)

    assert duplicate_key is not None
    assert duplicate_key.startswith("title-city-area-price:")
    assert "breda" in duplicate_key


def test_assign_duplicate_metadata_groups_same_listing_across_sources() -> None:
    listing_a = Listing(
        title="Kasteelplein appartement met balkon",
        source="Funda",
        url="https://funda.example/listing-1",
        city="Breda",
        price=1400,
        area_m2=55,
    )
    listing_b = Listing(
        title="Kasteelplein appartement met balkon",
        source="Pararius",
        url="https://pararius.example/listing-2",
        city="Breda",
        price=1400,
        area_m2=55,
    )

    assign_duplicate_metadata(listing_a)
    assign_duplicate_metadata(listing_b)

    assert listing_a.duplicate_group_id == listing_b.duplicate_group_id


def test_normalize_city_titlecases_known_cities() -> None:
    assert normalize_city("breda", "Breda") == "Breda"
    assert normalize_city("DEN HAAG", "Breda") == "Den Haag"
    assert normalize_city(None, "rotterdam") == "Rotterdam"


def test_listings_api_multi_city_filter() -> None:
    reset_listings()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="A",
                    source="Funda",
                    url="https://example.com/a",
                    city="Breda",
                    price=1400,
                    is_active=True,
                ),
                Listing(
                    title="B",
                    source="Funda",
                    url="https://example.com/b",
                    city="Tilburg",
                    price=1200,
                    is_active=True,
                ),
                Listing(
                    title="C",
                    source="Funda",
                    url="https://example.com/c",
                    city="Amsterdam",
                    price=1900,
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/?cities=Breda,Tilburg")
    assert response.status_code == 200
    payload = response.json()
    cities = {item["city"] for item in payload["items"]}
    assert cities == {"Breda", "Tilburg"}


def test_listings_api_exclude_sources_filter() -> None:
    reset_listings()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="A",
                    source="Funda",
                    source_key="funda",
                    url="https://example.com/a",
                    city="Breda",
                    price=1400,
                    is_active=True,
                ),
                Listing(
                    title="B",
                    source="Pararius",
                    source_key="pararius",
                    url="https://example.com/b",
                    city="Breda",
                    price=1400,
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/?city=Breda&exclude_sources=pararius")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1

    response_all = client.get("/api/listings/?city=Breda")
    assert response_all.status_code == 200
    assert response_all.json()["total"] == 2


def test_listings_api_available_now_filter_excludes_unknown() -> None:
    reset_listings()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="Available",
                    source="Funda",
                    url="https://example.com/available",
                    city="Breda",
                    availability_status="available",
                    is_active=True,
                ),
                Listing(
                    title="Unknown availability",
                    source="Funda",
                    url="https://example.com/unknown",
                    city="Breda",
                    availability_status="unknown",
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/?city=Breda&available_now=true")
    assert response.status_code == 200
    payload = response.json()
    assert all(item["availability_status"] == "available" for item in payload["items"])
    assert payload["total"] == 1


def test_listings_api_best_quality_sort() -> None:
    reset_listings()
    database = SessionLocal()
    try:
        database.add_all(
            [
                Listing(
                    title="High-quality",
                    source="Funda",
                    url="https://example.com/high",
                    city="Breda",
                    price=2000,
                    confidence_score=0.85,
                    is_active=True,
                ),
                Listing(
                    title="Low-quality",
                    source="Funda",
                    url="https://example.com/low",
                    city="Breda",
                    price=900,
                    confidence_score=0.4,
                    is_active=True,
                ),
            ]
        )
        database.commit()
    finally:
        database.close()

    response = client.get("/api/listings/?city=Breda&sort=best_quality")
    assert response.status_code == 200
    payload = response.json()
    prices = [item["price"] for item in payload["items"]]
    assert prices[0] == 2000  # the high-quality entry
    assert prices[1] == 900


def make_ranked_listing(index: int, source_key: str, confidence: float = 0.86) -> Listing:
    return Listing(
        id=index,
        title=f"Listing {index}",
        source=source_key.title(),
        source_key=source_key,
        url=f"https://example.com/{source_key}/{index}",
        city="Breda",
        confidence_score=confidence,
        is_active=True,
    )


def test_best_match_source_diversity_mixes_comparable_sources() -> None:
    listings = [
        *[make_ranked_listing(index, "marktplaats", 0.90 - index * 0.001) for index in range(1, 7)],
        *[make_ranked_listing(index, "funda", 0.88 - index * 0.001) for index in range(7, 10)],
        *[make_ranked_listing(index, "rotsvast", 0.87 - index * 0.001) for index in range(10, 13)],
    ]

    reranked = _diversify_best_match_listings(listings)
    top_sources = [listing.source_key for listing in reranked[:6]]

    assert "marktplaats" in top_sources
    assert "funda" in top_sources
    assert len(set(top_sources)) >= 2


def test_best_match_source_diversity_keeps_one_source_sets_unchanged() -> None:
    listings = [make_ranked_listing(index, "marktplaats") for index in range(1, 8)]

    reranked = _diversify_best_match_listings(listings)

    assert [listing.id for listing in reranked] == [listing.id for listing in listings]


def test_best_match_source_diversity_does_not_remove_marktplaats() -> None:
    listings = [
        make_ranked_listing(1, "marktplaats", 0.91),
        make_ranked_listing(2, "funda", 0.90),
        make_ranked_listing(3, "pararius", 0.89),
    ]

    reranked = _diversify_best_match_listings(listings)

    assert any(listing.source_key == "marktplaats" for listing in reranked)


def test_best_match_source_diversity_does_not_promote_clearly_weaker_listings() -> None:
    listings = [
        *[make_ranked_listing(index, "marktplaats", 0.95 - index * 0.005) for index in range(1, 7)],
        make_ranked_listing(7, "funda", 0.42),
    ]

    reranked = _diversify_best_match_listings(listings)

    assert reranked[-1].source_key == "funda"


def test_best_match_quality_score_softly_prefers_photo_when_otherwise_comparable() -> None:
    with_photo = make_ranked_listing(1, "funda", 0.82)
    without_photo = make_ranked_listing(2, "pararius", 0.82)
    with_photo.image_url = "https://example.com/photo.jpg"

    assert _listing_quality_score(with_photo) > _listing_quality_score(without_photo)


def test_best_match_quality_score_keeps_stronger_no_photo_listing_ahead() -> None:
    strong_without_photo = make_ranked_listing(1, "funda", 0.88)
    weaker_with_photo = make_ranked_listing(2, "pararius", 0.78)
    weaker_with_photo.image_url = "https://example.com/photo.jpg"

    assert _listing_quality_score(strong_without_photo) > _listing_quality_score(weaker_with_photo)

"""
Tests for map location fallback fixes and property type classification fixes.

Covers:
- infer_listing_city: description noise no longer overrides requested_city
- infer_property_type: house compounds, word-boundary kamer, correct ordering
- infer_property_subtype: terraced/corner/etc. detected from Dutch terms
- map fallback: Rotterdam listing stays Rotterdam, not Breda
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-loc-prop-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-loc-prop-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.listing_quality import (
    clean_listing_description,
    clean_listing_summary,
    clean_listing_text,
    clean_listing_title,
    infer_listing_city,
    infer_property_subtype,
    infer_property_type,
    normalize_space,
)


# ---------------------------------------------------------------------------
# infer_listing_city
# ---------------------------------------------------------------------------


def test_city_uses_scraped_city_when_available() -> None:
    """scraped_city beats description noise."""
    city = infer_listing_city(
        title="Mooie woning te huur",
        description="Vroeger woonde ik in Breda, nu verhuur ik in Rotterdam.",
        requested_city="Rotterdam",
        scraped_city="Rotterdam",
    )
    assert city == "Rotterdam"


def test_city_uses_requested_city_not_description_noise() -> None:
    """Description noise (e.g. 'formerly in Breda') must NOT override requested_city."""
    city = infer_listing_city(
        title="Appartement centrum",
        description="Ik verhuisde vanuit Breda naar Rotterdam voor mijn werk.",
        requested_city="Rotterdam",
        scraped_city=None,
    )
    assert city == "Rotterdam"


def test_city_from_title_wins_over_requested_city() -> None:
    """If the title explicitly names a city, trust it."""
    city = infer_listing_city(
        title="Huis in Amsterdam te huur",
        description="Mooie woning, neem contact op.",
        requested_city="Rotterdam",
        scraped_city=None,
    )
    assert city == "Amsterdam"


def test_city_falls_back_to_requested_when_no_signals() -> None:
    city = infer_listing_city(
        title="Gezellige studio",
        description="Ruime woning met tuin.",
        requested_city="Utrecht",
        scraped_city=None,
    )
    assert city == "Utrecht"


def test_city_empty_when_no_signals_and_no_requested() -> None:
    city = infer_listing_city(
        title="Woning te huur",
        description="",
        requested_city="",
        scraped_city=None,
    )
    assert city == ""


# ---------------------------------------------------------------------------
# presentation cleanup
# ---------------------------------------------------------------------------


def test_clean_listing_text_removes_raw_source_tokens() -> None:
    cleaned = clean_listing_text(
        "Appartement price_condition.per_month rental_price: 2200 per_month"
    )

    assert "price_condition" not in cleaned
    assert "rental_price" not in cleaned
    assert "per_month" not in cleaned


def test_clean_listing_title_prefers_address_when_available() -> None:
    cleaned = clean_listing_title(
        "price_condition.per_month Appartement gevonden in Rotterdam",
        address_text="Hertekade 253",
        city="Rotterdam",
    )

    assert cleaned == "Hertekade 253, Rotterdam"


def test_clean_listing_description_removes_duplicate_title_and_junk() -> None:
    cleaned = clean_listing_description(
        "Hertekade 253 Hertekade 253 price_condition.per_month Ruim appartement met balkon.",
        "Hertekade 253",
    )

    assert "price_condition" not in cleaned
    assert cleaned == "Ruim appartement met balkon."


def test_clean_listing_summary_falls_back_cleanly() -> None:
    summary = clean_listing_summary(
        "Nieuw: Apartment price_condition.per_month",
        "price_condition.per_month",
    )

    assert "price_condition" not in summary
    assert summary


# ---------------------------------------------------------------------------
# infer_property_type — bug fixes
# ---------------------------------------------------------------------------


def test_house_with_slaapkamers_is_not_room() -> None:
    """'slaapkamers' (bedrooms) must NOT trigger room classification."""
    result = infer_property_type("huis met 4 slaapkamers en een tuin rotterdam")
    assert result == "house"


def test_house_with_woonkamer_is_not_room() -> None:
    """'woonkamer' (living room) must NOT trigger room classification."""
    result = infer_property_type("appartement met grote woonkamer en open keuken")
    assert result == "apartment"


def test_rijtjeshuis_is_house() -> None:
    result = infer_property_type("rijtjeshuis te huur in rotterdam, 3 slaapkamers")
    assert result == "house"


def test_hoekwoning_is_house() -> None:
    result = infer_property_type("hoekwoning met grote tuin")
    assert result == "house"


def test_twee_onder_een_kap_is_house() -> None:
    result = infer_property_type("twee-onder-een-kap woning in breda")
    assert result == "house"


def test_vrijstaand_is_house() -> None:
    result = infer_property_type("vrijstaande woning met dubbele garage")
    assert result == "house"


def test_eengezinswoning_is_house() -> None:
    result = infer_property_type("eengezinswoning te huur tilburg")
    assert result == "house"


def test_standalone_kamer_is_room() -> None:
    """Standalone 'kamer' (not inside compound) must classify as room."""
    result = infer_property_type("kamer te huur in studentenhuis")
    assert result == "room"


def test_kamers_plural_does_not_trigger_room() -> None:
    """'kamers' (plural, meaning rooms count) must NOT trigger room classification."""
    result = infer_property_type("appartement 3 kamers rotterdam")
    assert result == "apartment"


def test_appartement_met_n_kamers_is_apartment() -> None:
    """'2 kamers appartement' is an apartment, not a room."""
    result = infer_property_type("2 kamers appartement amsterdam")
    assert result == "apartment"


def test_studio_is_studio() -> None:
    result = infer_property_type("studio te huur in den haag")
    assert result == "studio"


def test_parkeerplaats_is_parking() -> None:
    result = infer_property_type("parkeerplaats te huur")
    assert result == "parking"


def test_generic_woning_is_house() -> None:
    result = infer_property_type("woning te huur in leiden")
    assert result == "house"


def test_unknown_when_no_keywords() -> None:
    result = infer_property_type("te huur in rotterdam centrum 750 per maand")
    assert result == "unknown"


# ---------------------------------------------------------------------------
# infer_property_subtype
# ---------------------------------------------------------------------------


def test_subtype_rijtjeshuis_is_terraced_house() -> None:
    sub = infer_property_subtype("rijtjeshuis 3 kamers", "house")
    assert sub == "terraced_house"


def test_subtype_hoekwoning_is_corner_house() -> None:
    sub = infer_property_subtype("hoekwoning met grote zij-tuin", "house")
    assert sub == "corner_house"


def test_subtype_two_under_one_roof_is_semi_detached() -> None:
    sub = infer_property_subtype("twee-onder-een-kap woning", "house")
    assert sub == "semi_detached_house"


def test_subtype_vrijstaand_is_detached() -> None:
    sub = infer_property_subtype("vrijstaand huis met zwembad", "house")
    assert sub == "detached_house"


def test_subtype_herenhuis_is_townhouse() -> None:
    sub = infer_property_subtype("herenhuis in het centrum", "house")
    assert sub == "townhouse"


def test_subtype_bungalow() -> None:
    sub = infer_property_subtype("bungalow met tuin", "house")
    assert sub == "bungalow"


def test_subtype_villa() -> None:
    sub = infer_property_subtype("villa aan de bosrand", "house")
    assert sub == "villa"


def test_subtype_other_house_when_no_specific_term() -> None:
    sub = infer_property_subtype("woning te huur", "house")
    assert sub == "other_house"


def test_subtype_none_for_apartment_without_specific_term() -> None:
    sub = infer_property_subtype("appartement te huur amsterdam", "apartment")
    assert sub is None


def test_subtype_penthouse_for_apartment() -> None:
    sub = infer_property_subtype("penthouse met terras", "apartment")
    assert sub == "penthouse"


def test_subtype_none_for_room() -> None:
    sub = infer_property_subtype("kamer te huur", "room")
    assert sub is None


def test_subtype_none_for_parking() -> None:
    sub = infer_property_subtype("parkeerplaats", "parking")
    assert sub is None

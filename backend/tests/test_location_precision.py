from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{tempfile.mkdtemp(prefix='rentscout-location-precision-tests-')}/test.db",
)
os.environ.setdefault("JWT_SECRET_KEY", "test-location-precision-secret-at-least-32-bytes")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.location import AddressParts, GeocodeAttemptResult, geocode_location


def test_geocode_location_tries_full_address_postcode_city_first(monkeypatch) -> None:
    attempted_queries: list[str] = []

    def fake_pdok(_database, query):
        attempted_queries.append(query)
        return GeocodeAttemptResult(
            query=query,
            provider="pdok",
            success=True,
            latitude=51.922,
            longitude=4.489,
            precision="exact_address",
            confidence=0.92,
            matched_label="Hertekade 253, 3011 XV Rotterdam",
        )

    monkeypatch.setattr("app.services.location.cached_success", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.services.location.store_success", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.services.location.geocode_query_pdok", fake_pdok)

    result = geocode_location(
        None,
        AddressParts(
            address_text="Hertekade 253, Rotterdam",
            postal_code="3011 XV",
            city="Rotterdam",
            location_precision="exact_address",
            location_confidence=0.9,
        ),
    )

    assert attempted_queries[0] == "Hertekade 253, Rotterdam 3011 XV"
    assert result is not None
    assert result["location_precision"] == "exact_address"

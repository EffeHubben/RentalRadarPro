from __future__ import annotations

from contextvars import ContextVar
from copy import deepcopy
from typing import Any


_CURRENT_DIAGNOSTICS: ContextVar[dict[str, Any] | None] = ContextVar(
    "rentscout_scraper_diagnostics",
    default=None,
)


def _new_diagnostics(source_key: str | None = None, city: str | None = None) -> dict[str, Any]:
    return {
        "source_key": source_key,
        "city": city,
        "fetches": [],
        "requested_urls": [],
        "http_statuses": [],
        "response_sizes": [],
        "debug_files": [],
        "raw_candidates_found": 0,
        "parsed_successfully": 0,
        "city_mismatch_filtered": 0,
        "validation_filtered": 0,
    }


def reset_scraper_diagnostics(source_key: str | None = None, city: str | None = None) -> None:
    _CURRENT_DIAGNOSTICS.set(_new_diagnostics(source_key=source_key, city=city))


def _diagnostics() -> dict[str, Any]:
    diagnostics = _CURRENT_DIAGNOSTICS.get()
    if diagnostics is None:
        diagnostics = _new_diagnostics()
        _CURRENT_DIAGNOSTICS.set(diagnostics)
    return diagnostics


def record_fetch(
    *,
    url: str,
    status_code: int | None = None,
    response_size: int | None = None,
    title: str | None = None,
    debug_file: str | None = None,
    error: str | None = None,
) -> None:
    diagnostics = _diagnostics()
    fetch = {
        "url": url,
        "status_code": status_code,
        "response_size": response_size,
        "title": title,
        "debug_file": debug_file,
        "error": error,
    }
    diagnostics["fetches"].append(fetch)
    diagnostics["requested_urls"].append(url)
    if status_code is not None:
        diagnostics["http_statuses"].append(status_code)
    if response_size is not None:
        diagnostics["response_sizes"].append(response_size)
    if debug_file:
        diagnostics["debug_files"].append(debug_file)


def add_metric(name: str, amount: int = 1) -> None:
    diagnostics = _diagnostics()
    diagnostics[name] = int(diagnostics.get(name, 0) or 0) + amount


def set_metric(name: str, value: Any) -> None:
    _diagnostics()[name] = value


def scraper_diagnostics_snapshot() -> dict[str, Any]:
    return deepcopy(_diagnostics())

"""Image proxy — serves CDN images that require a specific Referer header.

Marktplaats and similar sources protect their CDN with hotlink checks: a
browser request from rentscout.nl carries no matching Referer, so the CDN
returns a 403. This endpoint re-fetches the image server-side (where we can
set any headers we like) and streams it back to the browser.
"""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response


router = APIRouter(prefix="/api/proxy", tags=["Proxy"])
logger = logging.getLogger("rentscout.proxy")

ALLOWED_HOSTS: frozenset[str] = frozenset(
    {
        "images.marktplaats.com",
        "img.marktplaats.com",
        "marktplaats.nl",
        "www.marktplaats.nl",
        "photos.zah.nl",
        "cdn.ikwilhuren.nu",
        "media.ikwilhuren.nu",
        "images.pararius.nl",
        "img.pararius.nl",
        "images.funda.nl",
        "cloud.funda.nl",
    }
)

_SOURCE_REFERERS: dict[str, str] = {
    "marktplaats": "https://www.marktplaats.nl/",
    "ikwilhuren": "https://ikwilhuren.nu/",
    "pararius": "https://www.pararius.nl/",
    "funda": "https://www.funda.nl/",
}

_HOST_REFERER: dict[str, str] = {
    "images.marktplaats.com": _SOURCE_REFERERS["marktplaats"],
    "img.marktplaats.com": _SOURCE_REFERERS["marktplaats"],
    "marktplaats.nl": _SOURCE_REFERERS["marktplaats"],
    "www.marktplaats.nl": _SOURCE_REFERERS["marktplaats"],
    "photos.zah.nl": _SOURCE_REFERERS["marktplaats"],
    "cdn.ikwilhuren.nu": _SOURCE_REFERERS["ikwilhuren"],
    "media.ikwilhuren.nu": _SOURCE_REFERERS["ikwilhuren"],
    "images.pararius.nl": _SOURCE_REFERERS["pararius"],
    "img.pararius.nl": _SOURCE_REFERERS["pararius"],
    "images.funda.nl": _SOURCE_REFERERS["funda"],
    "cloud.funda.nl": _SOURCE_REFERERS["funda"],
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}


@router.get("/image")
async def proxy_image(url: str = Query(..., min_length=8, max_length=2048)):
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")

    if host not in ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail="Host not allowed")

    referer = _HOST_REFERER.get(host, f"https://{host}/")
    headers = {**_HEADERS, "Referer": referer}

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        logger.warning("proxy_image_fetch_error url=%s error=%s", url, exc)
        raise HTTPException(status_code=502, detail="Upstream fetch failed")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Image not found")

    if response.status_code != 200:
        logger.warning("proxy_image_upstream_error url=%s status=%s", url, response.status_code)
        raise HTTPException(status_code=502, detail="Upstream error")

    content_type = response.headers.get("content-type", "image/jpeg")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=502, detail="Upstream did not return an image")

    return Response(
        content=response.content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Proxy-Host": host,
        },
    )

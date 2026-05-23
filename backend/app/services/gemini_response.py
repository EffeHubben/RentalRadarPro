from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.tenant import TenantProfile

logger = logging.getLogger(__name__)

_GEMINI_TIMEOUT = 12

_STYLE_INSTRUCTIONS: dict[str, str] = {
    "short": "Schrijf een korte, bondige reactie van maximaal 4-5 zinnen.",
    "professional": "Schrijf een professionele, zakelijke reactie.",
    "warm": "Schrijf een warme, persoonlijke reactie.",
}


def _build_prompt(profile: TenantProfile, listing: Listing | None, style: str) -> str:
    parts = [
        "Je schrijft een Nederlandse huurreactie voor een particuliere huurder.",
        _STYLE_INSTRUCTIONS.get(style, _STYLE_INSTRUCTIONS["professional"]),
        "Gebruik ALLEEN de onderstaande gegevens. Verzin niets bij. Laat ontbrekende velden weg.",
        "Als een document niet beschikbaar is, noem het dan NIET.",
        "Geef alleen de berichttekst terug, zonder markdown, zonder opmaak.",
        "",
        "=== WONING ===",
    ]

    if listing:
        if listing.title:
            parts.append(f"Titel: {listing.title}")
        if listing.city:
            parts.append(f"Stad: {listing.city}")
        if listing.price is not None:
            parts.append(f"Huurprijs: EUR {listing.price} per maand")
        if listing.property_type and listing.property_type != "unknown":
            type_label = {
                "apartment": "appartement",
                "studio": "studio",
                "room": "kamer",
                "house": "woning",
            }.get(listing.property_type, listing.property_type)
            parts.append(f"Type: {type_label}")
        if listing.area_m2:
            parts.append(f"Oppervlak: {listing.area_m2} m2")
        if listing.availability_status == "available":
            parts.append("Beschikbaarheid: nu beschikbaar")
    else:
        parts.append("(geen specifieke woning)")

    parts.append("")
    parts.append("=== HUURDER ===")

    if profile.full_name:
        parts.append(f"Naam: {profile.full_name}")
    if profile.age:
        parts.append(f"Leeftijd: {profile.age}")
    if profile.occupation_or_study:
        parts.append(f"Beroep/studie: {profile.occupation_or_study}")
    if profile.monthly_income_range:
        parts.append(f"Inkomen indicatie: {profile.monthly_income_range}")
    if profile.household_size:
        parts.append(f"Huishoudgrootte: {profile.household_size} persoon/personen")
    if profile.pets is True:
        note = (profile.pet_notes or "").strip()
        parts.append(f"Huisdieren: ja{f' ({note})' if note else ''}")
    elif profile.pets is False:
        parts.append("Huisdieren: nee")
    if profile.smoker is False:
        parts.append("Roker: nee")
    if profile.preferred_city:
        parts.append(f"Voorkeurstad: {profile.preferred_city}")
    if profile.move_in_date:
        parts.append(f"Gewenste ingangsdatum: {profile.move_in_date}")
    if profile.short_intro:
        parts.append(f"Korte introductie: {profile.short_intro}")
    if profile.why_looking:
        parts.append(f"Waarom op zoek: {profile.why_looking}")
    if profile.strengths_as_tenant:
        parts.append(f"Sterke punten als huurder: {profile.strengths_as_tenant}")

    docs = []
    if profile.id_ready:
        docs.append("identificatie")
    if profile.income_proof_ready:
        docs.append("inkomensbewijs")
    if profile.employer_statement_ready:
        docs.append("werkgeversverklaring")
    if profile.bank_statement_ready:
        docs.append("bankafschrift")
    if profile.motivation_ready:
        docs.append("motivatiebrief")
    if docs:
        parts.append(f"Beschikbare documenten: {', '.join(docs)}")
    if profile.guarantor_available:
        parts.append("Garantsteller: beschikbaar")

    parts.append("")
    parts.append("Schrijf nu de huurreactie:")

    return "\n".join(parts)


def call_gemini(profile: TenantProfile, listing: Listing | None, style: str, *, api_key: str, model: str) -> str | None:
    prompt = _build_prompt(profile, listing, style)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 800,
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=_GEMINI_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text:
            logger.info("ai_response provider=gemini status=success")
            return text
        logger.warning("ai_response provider=gemini status=empty_response")
        return None
    except requests.Timeout:
        logger.warning("ai_response provider=gemini status=timeout")
        return None
    except Exception as exc:
        logger.warning("ai_response provider=gemini status=error reason=%s", type(exc).__name__)
        return None

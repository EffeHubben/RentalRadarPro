from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.models.listing import Listing
from app.models.tenant import TenantProfile


ResponseStyle = Literal["short", "professional", "warm"]


@dataclass
class GeneratedTenantResponse:
    message: str
    style: ResponseStyle
    missing_fields: list[str] = field(default_factory=list)


PROFILE_COMPLETION_FIELDS = [
    "full_name",
    "age",
    "occupation_or_study",
    "monthly_income_range",
    "household_size",
    "pets",
    "smoker",
    "preferred_city",
    "move_in_date",
    "short_intro",
    "why_looking",
    "strengths_as_tenant",
    "id_ready",
    "income_proof_ready",
    "employer_statement_ready",
    "bank_statement_ready",
    "motivation_ready",
    "guarantor_available",
]


def _has_value(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, bool):
        return value is True
    return value is not None


def calculate_profile_completion(profile: TenantProfile | None) -> int:
    if profile is None:
        return 0

    completed = 0
    for field_name in PROFILE_COMPLETION_FIELDS:
        value = getattr(profile, field_name, None)
        if field_name in {"pets", "smoker"}:
            completed += int(value is not None)
        else:
            completed += int(_has_value(value))
    return round(completed / len(PROFILE_COMPLETION_FIELDS) * 100)


def _clean(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _sentence(value: object) -> str:
    text = _clean(value)
    if not text:
        return ""
    return text if text[-1] in ".!?" else f"{text}."


def _listing_label(listing: Listing | None) -> str:
    if listing is None:
        return "de woning"

    title = _clean(listing.title)
    city = _clean(listing.city)
    address = _clean(listing.address_text)

    if title and city:
        return f"{title} in {city}"
    if title:
        return title
    if address and city:
        return f"{address} in {city}"
    if city:
        return f"de woning in {city}"
    return "de woning"


def _listing_reason(listing: Listing | None) -> str:
    if listing is None:
        return "De woning spreekt mij aan."

    parts: list[str] = []
    if listing.city:
        parts.append(f"de locatie in {listing.city}")
    if listing.property_type and listing.property_type != "unknown":
        property_type = {
            "apartment": "het appartement",
            "studio": "de studio",
            "room": "de kamer",
            "house": "de woning",
            "parking": "de ruimte",
        }.get(listing.property_type, "de woning")
        parts.append(property_type)
    if listing.price is not None:
        parts.append(f"de huurprijs van EUR {listing.price}")
    if listing.availability_status == "available":
        parts.append("de beschikbaarheid")

    if not parts:
        return "De woning spreekt mij aan vanwege de omschrijving."
    if len(parts) == 1:
        return f"De woning spreekt mij aan vanwege {parts[0]}."
    return f"De woning spreekt mij aan vanwege {', '.join(parts[:-1])} en {parts[-1]}."


def _documents_sentence(profile: TenantProfile) -> str:
    ready_documents: list[str] = []
    if profile.id_ready:
        ready_documents.append("identificatie")
    if profile.income_proof_ready:
        ready_documents.append("inkomensbewijs")
    if profile.employer_statement_ready:
        ready_documents.append("werkgeversverklaring")
    if profile.bank_statement_ready:
        ready_documents.append("bankafschrift")
    if profile.motivation_ready:
        ready_documents.append("motivatie")

    if not ready_documents and not profile.guarantor_available:
        return ""

    parts: list[str] = []
    if ready_documents:
        if len(ready_documents) == 1:
            parts.append(f"{ready_documents[0]} is klaar")
        else:
            parts.append(f"{', '.join(ready_documents[:-1])} en {ready_documents[-1]} zijn klaar")
    if profile.guarantor_available:
        parts.append("een garantsteller is beschikbaar")

    return f"Indien gewenst kan ik aanvullende informatie delen: {'; '.join(parts)}."


def _profile_lines(profile: TenantProfile, missing_fields: list[str]) -> list[str]:
    lines: list[str] = []

    if profile.short_intro:
        lines.append(_sentence(profile.short_intro))
    if profile.occupation_or_study:
        lines.append(f"Ik ben {profile.occupation_or_study.strip()}.")
    else:
        missing_fields.append("occupation_or_study")
    if profile.monthly_income_range:
        lines.append(f"Mijn inkomensindicatie is {profile.monthly_income_range.strip()}.")
    else:
        missing_fields.append("monthly_income_range")
    if profile.household_size:
        lines.append(f"Ik zoek met een huishouden van {profile.household_size} persoon/personen.")
    else:
        missing_fields.append("household_size")
    if profile.pets is True:
        note = _clean(profile.pet_notes)
        lines.append(f"Ik heb huisdieren{f': {note}' if note else ''}.")
    elif profile.pets is False:
        lines.append("Ik heb geen huisdieren.")
    else:
        missing_fields.append("pets")
    if profile.smoker is False:
        lines.append("Ik rook niet.")
    elif profile.smoker is None:
        missing_fields.append("smoker")
    if profile.why_looking:
        lines.append(_sentence(profile.why_looking))
    if profile.strengths_as_tenant:
        lines.append(_sentence(profile.strengths_as_tenant))

    return lines


def generate_tenant_response(
    profile: TenantProfile | None,
    listing: Listing | None,
    style: ResponseStyle = "professional",
) -> GeneratedTenantResponse:
    if style not in {"short", "professional", "warm"}:
        style = "professional"

    missing_fields: list[str] = []
    listing_label = _listing_label(listing)
    name = _clean(profile.full_name) if profile else ""

    if not name:
        missing_fields.append("full_name")

    if profile is None:
        missing_fields.extend(["tenant_profile", "occupation_or_study", "monthly_income_range"])
        signature = "[naam]"
        return GeneratedTenantResponse(
            message=(
                f"Beste verhuurder,\n\n"
                f"Ik ben geinteresseerd in {listing_label}. {_listing_reason(listing)}\n\n"
                f"Graag kom ik in aanmerking voor een bezichtiging.\n\n"
                f"Met vriendelijke groet,\n{signature}"
            ),
            style=style,
            missing_fields=list(dict.fromkeys(missing_fields)),
        )

    interest_intro = (
        f"Mijn naam is {name} en ik ben geinteresseerd"
        if name
        else "Ik ben geinteresseerd"
    )
    signature = name or "[naam]"
    personal_lines = _profile_lines(profile, missing_fields)
    docs = _documents_sentence(profile)

    if style == "short":
        body = [
            "Beste verhuurder,",
            "",
            f"{interest_intro} in {listing_label}.",
            _listing_reason(listing),
        ]
        for line in personal_lines[:3]:
            body.append(line)
        if docs:
            body.append(docs)
        body.extend(["", "Graag hoor ik of een bezichtiging mogelijk is.", "", f"Met vriendelijke groet,\n{signature}"])
    elif style == "warm":
        body = [
            "Beste verhuurder,",
            "",
            f"{f'Mijn naam is {name} en ik reageer graag' if name else 'Ik reageer graag'} op {listing_label}.",
            f"{_listing_reason(listing)} Ik zie mijzelf hier met plezier wonen.",
        ]
        body.extend(personal_lines)
        if docs:
            body.append(docs)
        body.extend(["", "Ik licht mijn reactie graag verder toe en kom met plezier langs voor een bezichtiging.", "", f"Met vriendelijke groet,\n{signature}"])
    else:
        body = [
            "Beste verhuurder,",
            "",
            f"{interest_intro} in {listing_label}.",
            _listing_reason(listing),
        ]
        body.extend(personal_lines)
        if docs:
            body.append(docs)
        body.extend(["", "Graag kom ik in aanmerking voor een bezichtiging.", "", f"Met vriendelijke groet,\n{signature}"])

    message = "\n".join(line for line in body if line is not None)
    return GeneratedTenantResponse(
        message=message,
        style=style,
        missing_fields=list(dict.fromkeys(missing_fields)),
    )

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.db import get_database_session
from app.models.tenant import TenantProfile
from app.models.user import User
from app.schemas.tenant import (
    EmptyTenantProfileResponse,
    GenerateResponseRequest,
    GenerateResponseResponse,
    TenantProfileResponse,
    TenantProfileUpdate,
)
from app.services.tenant_response_generator import (
    calculate_profile_completion,
    generate_tenant_response,
)


router = APIRouter(prefix="/api/account", tags=["Tenant profile"])


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _profile_response(profile: TenantProfile) -> TenantProfileResponse:
    return TenantProfileResponse.model_validate(profile).model_copy(
        update={"completion_percentage": calculate_profile_completion(profile)}
    )


@router.get("/tenant-profile", response_model=TenantProfileResponse | EmptyTenantProfileResponse)
def get_tenant_profile(
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    profile = database.query(TenantProfile).filter(TenantProfile.user_id == current_user.id).first()

    if profile is None:
        return EmptyTenantProfileResponse()

    return _profile_response(profile)


@router.put("/tenant-profile", response_model=TenantProfileResponse)
def update_tenant_profile(
    payload: TenantProfileUpdate,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    profile = database.query(TenantProfile).filter(TenantProfile.user_id == current_user.id).first()

    if profile is None:
        profile = TenantProfile(user_id=current_user.id)
        database.add(profile)

    values = payload.model_dump()
    for field_name, value in values.items():
        setattr(profile, field_name, _clean_text(value) if isinstance(value, str) or value is None else value)

    profile.updated_at = datetime.utcnow()
    database.commit()
    database.refresh(profile)
    return _profile_response(profile)


@router.post("/tenant-profile/example-response", response_model=GenerateResponseResponse)
def generate_tenant_profile_example(
    payload: GenerateResponseRequest,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    profile = database.query(TenantProfile).filter(TenantProfile.user_id == current_user.id).first()
    generated = generate_tenant_response(profile, None, payload.style)
    return GenerateResponseResponse(
        message=generated.message,
        style=generated.style,
        missing_fields=generated.missing_fields,
    )

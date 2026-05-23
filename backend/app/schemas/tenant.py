from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ResponseStyle = Literal["short", "professional", "warm"]


class TenantProfileBase(BaseModel):
    full_name: str | None = Field(default=None, max_length=160)
    age: int | None = Field(default=None, ge=16, le=120)
    occupation_or_study: str | None = Field(default=None, max_length=255)
    monthly_income_range: str | None = Field(default=None, max_length=120)
    household_size: int | None = Field(default=None, ge=1, le=20)
    pets: bool | None = None
    pet_notes: str | None = Field(default=None, max_length=255)
    smoker: bool | None = None
    preferred_city: str | None = Field(default=None, max_length=120)
    move_in_date: str | None = Field(default=None, max_length=80)
    short_intro: str | None = None
    why_looking: str | None = None
    strengths_as_tenant: str | None = None
    id_ready: bool = False
    income_proof_ready: bool = False
    employer_statement_ready: bool = False
    bank_statement_ready: bool = False
    motivation_ready: bool = False
    guarantor_available: bool = False


class TenantProfileUpdate(TenantProfileBase):
    pass


class TenantProfileResponse(TenantProfileBase):
    id: int
    user_id: int
    completion_percentage: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmptyTenantProfileResponse(TenantProfileBase):
    completion_percentage: int = 0


class GenerateResponseRequest(BaseModel):
    style: ResponseStyle = "professional"


class GenerateResponseResponse(BaseModel):
    message: str
    style: ResponseStyle
    missing_fields: list[str] = Field(default_factory=list)
    provider_used: str = "template"


class SaveRentalResponseRequest(BaseModel):
    style: ResponseStyle = "professional"
    generated_message: str = Field(min_length=1)


class SavedRentalResponseResponse(BaseModel):
    id: int
    user_id: int
    listing_id: int | None = None
    listing_source_id: str | None = None
    listing_external_id: str | None = None
    style: str
    generated_message: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.database.db import Base


class TenantProfile(Base):
    __tablename__ = "tenant_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    full_name = Column(String(160), nullable=True)
    age = Column(Integer, nullable=True)
    occupation_or_study = Column(String(255), nullable=True)
    monthly_income_range = Column(String(120), nullable=True)
    household_size = Column(Integer, nullable=True)
    pets = Column(Boolean, nullable=True)
    pet_notes = Column(String(255), nullable=True)
    smoker = Column(Boolean, nullable=True)
    preferred_city = Column(String(120), nullable=True)
    move_in_date = Column(String(80), nullable=True)
    short_intro = Column(Text, nullable=True)
    why_looking = Column(Text, nullable=True)
    strengths_as_tenant = Column(Text, nullable=True)
    id_ready = Column(Boolean, nullable=False, default=False, server_default="0")
    income_proof_ready = Column(Boolean, nullable=False, default=False, server_default="0")
    employer_statement_ready = Column(Boolean, nullable=False, default=False, server_default="0")
    bank_statement_ready = Column(Boolean, nullable=False, default=False, server_default="0")
    motivation_ready = Column(Boolean, nullable=False, default=False, server_default="0")
    guarantor_available = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class GeminiUsageLog(Base):
    __tablename__ = "gemini_usage_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_gemini_usage_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    usage_date = Column(String(10), nullable=False)
    count = Column(Integer, nullable=False, default=0)


class SavedRentalResponse(Base):
    __tablename__ = "saved_rental_responses"
    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_saved_rental_response_user_listing"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=True, index=True)
    listing_source_id = Column(String(120), nullable=True)
    listing_external_id = Column(String(255), nullable=True)
    style = Column(String(30), nullable=False, default="professional")
    generated_message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

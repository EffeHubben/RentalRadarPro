from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.database.db import Base


class GeocodeCache(Base):
    __tablename__ = "geocode_cache"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(500), nullable=False, unique=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    precision = Column(String(30), nullable=False)
    confidence = Column(Float, nullable=False)
    provider = Column(String(40), nullable=True)
    matched_label = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class GeocodeFailure(Base):
    __tablename__ = "geocode_failures"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(500), nullable=False, unique=True, index=True)
    provider = Column(String(40), nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

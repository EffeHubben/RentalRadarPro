from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database.db import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    anonymous_session_id = Column(String(64), nullable=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    path = Column(String(500), nullable=True)
    listing_id = Column(Integer, nullable=True, index=True)
    city = Column(String(100), nullable=True)
    referrer_domain = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

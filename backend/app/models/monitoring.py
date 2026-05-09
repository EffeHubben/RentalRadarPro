from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database.db import Base


class UptimeCheck(Base):
    __tablename__ = "uptime_checks"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(80), nullable=False, index=True)
    status = Column(String(30), nullable=False)
    checked_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    latency_ms = Column(Integer, nullable=True)
    error = Column(String(500), nullable=True)

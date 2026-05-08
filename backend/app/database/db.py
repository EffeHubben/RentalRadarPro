from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings


IS_SQLITE = settings.database_url.startswith("sqlite")


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 30} if IS_SQLITE else {},
    pool_pre_ping=True,
)


if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def configure_sqlite_connection(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA busy_timeout = 30000")
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


LISTING_COLUMN_MIGRATIONS = {
    "property_type": "ALTER TABLE listings ADD COLUMN property_type VARCHAR(30) DEFAULT 'unknown'",
    "private_kitchen": "ALTER TABLE listings ADD COLUMN private_kitchen BOOLEAN",
    "private_bathroom": "ALTER TABLE listings ADD COLUMN private_bathroom BOOLEAN",
    "private_toilet": "ALTER TABLE listings ADD COLUMN private_toilet BOOLEAN",
    "shared_laundry": "ALTER TABLE listings ADD COLUMN shared_laundry BOOLEAN",
    "is_shared": "ALTER TABLE listings ADD COLUMN is_shared BOOLEAN",
    "is_woningruil": "ALTER TABLE listings ADD COLUMN is_woningruil BOOLEAN DEFAULT 0",
    "availability_status": "ALTER TABLE listings ADD COLUMN availability_status VARCHAR(30) DEFAULT 'unknown'",
    "is_available": "ALTER TABLE listings ADD COLUMN is_available BOOLEAN",
    "confidence_score": "ALTER TABLE listings ADD COLUMN confidence_score FLOAT",
    "last_seen_at": "ALTER TABLE listings ADD COLUMN last_seen_at DATETIME",
    "address_text": "ALTER TABLE listings ADD COLUMN address_text TEXT",
    "street_name": "ALTER TABLE listings ADD COLUMN street_name VARCHAR(255)",
    "house_number": "ALTER TABLE listings ADD COLUMN house_number VARCHAR(30)",
    "postal_code": "ALTER TABLE listings ADD COLUMN postal_code VARCHAR(20)",
    "latitude": "ALTER TABLE listings ADD COLUMN latitude FLOAT",
    "longitude": "ALTER TABLE listings ADD COLUMN longitude FLOAT",
    "location_precision": "ALTER TABLE listings ADD COLUMN location_precision VARCHAR(30) DEFAULT 'unknown'",
    "location_confidence": "ALTER TABLE listings ADD COLUMN location_confidence FLOAT DEFAULT 0",
    "duplicate_key": "ALTER TABLE listings ADD COLUMN duplicate_key VARCHAR(255)",
    "canonical_key": "ALTER TABLE listings ADD COLUMN canonical_key VARCHAR(255)",
    "duplicate_group_id": "ALTER TABLE listings ADD COLUMN duplicate_group_id VARCHAR(255)",
    "source_count": "ALTER TABLE listings ADD COLUMN source_count INTEGER DEFAULT 1",
    "source_key": "ALTER TABLE listings ADD COLUMN source_key VARCHAR(80)",
    "first_seen_at": "ALTER TABLE listings ADD COLUMN first_seen_at DATETIME",
    "last_checked_at": "ALTER TABLE listings ADD COLUMN last_checked_at DATETIME",
}

SCAN_HISTORY_COLUMN_MIGRATIONS = {
    "skipped_count": "ALTER TABLE scan_history ADD COLUMN skipped_count INTEGER DEFAULT 0",
    "duplicate_count": "ALTER TABLE scan_history ADD COLUMN duplicate_count INTEGER DEFAULT 0",
    "duration_ms": "ALTER TABLE scan_history ADD COLUMN duration_ms INTEGER",
}

GEOCODE_CACHE_COLUMN_MIGRATIONS = {
    "provider": "ALTER TABLE geocode_cache ADD COLUMN provider VARCHAR(40)",
    "matched_label": "ALTER TABLE geocode_cache ADD COLUMN matched_label TEXT",
}

USER_COLUMN_MIGRATIONS = {
    "is_admin": "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
    "plan": "ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'free'",
    "subscription_status": "ALTER TABLE users ADD COLUMN subscription_status VARCHAR(30) NOT NULL DEFAULT 'inactive'",
    "stripe_customer_id": "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)",
    "stripe_subscription_id": "ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)",
    "subscription_current_period_end": "ALTER TABLE users ADD COLUMN subscription_current_period_end DATETIME",
    "subscription_cancel_at_period_end": "ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0",
    "email_verified": "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0",
    "email_verification_token_hash": "ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR(128)",
    "email_verification_sent_at": "ALTER TABLE users ADD COLUMN email_verification_sent_at DATETIME",
    "email_verification_expires_at": "ALTER TABLE users ADD COLUMN email_verification_expires_at DATETIME",
    "password_reset_token_hash": "ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(128)",
    "password_reset_sent_at": "ALTER TABLE users ADD COLUMN password_reset_sent_at DATETIME",
    "password_reset_expires_at": "ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME",
}


def migrate_listing_table() -> None:
    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(listings)"))
        }

        for column_name, migration_sql in LISTING_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(migration_sql))

        connection.execute(
            text(
                """
                UPDATE listings
                SET property_type = 'unknown'
                WHERE property_type IS NULL OR property_type = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET is_woningruil = 0
                WHERE is_woningruil IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET source_count = 1
                WHERE source_count IS NULL OR source_count < 1
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET source_key = lower(replace(source, ' ', '_'))
                WHERE source_key IS NULL OR source_key = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET first_seen_at = COALESCE(created_at, updated_at, last_seen_at)
                WHERE first_seen_at IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET last_checked_at = COALESCE(last_seen_at, updated_at, created_at)
                WHERE last_checked_at IS NULL
                """
            )
        )


def migrate_scan_history_table() -> None:
    with engine.begin() as connection:
        existing_tables = {
            row[0]
            for row in connection.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
        }

        if "scan_history" not in existing_tables:
            return

        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(scan_history)"))
        }

        for column_name, migration_sql in SCAN_HISTORY_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(migration_sql))


def migrate_users_table() -> None:
    with engine.begin() as connection:
        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(users)"))
        }

        for column_name, migration_sql in USER_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(migration_sql))

        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_users_email_verification_token_hash ON users (email_verification_token_hash)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_users_password_reset_token_hash ON users (password_reset_token_hash)"
            )
        )


def migrate_geocode_cache_table() -> None:
    with engine.begin() as connection:
        existing_tables = {
            row[0]
            for row in connection.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
        }

        if "geocode_cache" not in existing_tables:
            return

        existing_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(geocode_cache)"))
        }

        for column_name, migration_sql in GEOCODE_CACHE_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(migration_sql))
        connection.execute(
            text(
                """
                UPDATE listings
                SET availability_status = 'unknown'
                WHERE availability_status IS NULL OR availability_status = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET last_seen_at = COALESCE(updated_at, created_at)
                WHERE last_seen_at IS NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET location_precision = 'unknown'
                WHERE location_precision IS NULL OR location_precision = ''
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE listings
                SET location_confidence = 0
                WHERE location_confidence IS NULL
                """
            )
        )


def create_database_tables(*, run_backfills: bool = True) -> None:
    from app.models import email_delivery, geocode, listing, scan_history, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_listing_table()
    migrate_scan_history_table()
    migrate_geocode_cache_table()
    migrate_users_table()
    if run_backfills:
        backfill_existing_listing_locations()
        backfill_existing_listing_availability()
        backfill_existing_listing_duplicates()


def backfill_existing_listing_locations(limit: int = 500) -> None:
    from app.models.listing import Listing
    from app.services.location import city_coordinates, extract_address_parts, slug_to_text

    database = SessionLocal()

    try:
        listings = (
            database.query(Listing)
            .filter(
                (Listing.address_text.is_(None))
                | (Listing.location_precision.is_(None))
                | (Listing.location_precision == "unknown")
            )
            .limit(limit)
            .all()
        )

        for listing in listings:
            parts = extract_address_parts(
                " ".join(
                    [
                        listing.title or "",
                        listing.description or "",
                        slug_to_text(listing.url),
                    ]
                ),
                listing.city,
            )

            if not parts.address_text and not parts.city:
                continue

            listing.address_text = listing.address_text or parts.address_text
            listing.street_name = listing.street_name or parts.street_name
            listing.house_number = listing.house_number or parts.house_number
            listing.postal_code = listing.postal_code or parts.postal_code

            if listing.latitude is None or listing.longitude is None:
                coords = city_coordinates(parts.city or listing.city)

                if coords:
                    listing.latitude = coords[0]
                    listing.longitude = coords[1]
                    listing.location_precision = "city"
                    listing.location_confidence = max(listing.location_confidence or 0.0, 0.35)
                elif parts.location_precision != "unknown":
                    listing.location_precision = parts.location_precision
                    listing.location_confidence = max(
                        listing.location_confidence or 0.0,
                        parts.location_confidence,
                    )

        database.commit()
    finally:
        database.close()


def backfill_existing_listing_duplicates(limit: int = 2000) -> None:
    from app.models.listing import Listing
    from app.services.duplicates import refresh_duplicate_groups

    database = SessionLocal()

    try:
        listings = database.query(Listing).limit(limit).all()
        refresh_duplicate_groups(database, listings)
        database.commit()
    finally:
        database.close()


def backfill_existing_listing_availability(limit: int = 2000) -> None:
    from app.models.listing import Listing
    from app.scrapers.base import detect_availability_status

    database = SessionLocal()

    try:
        listings = (
            database.query(Listing)
            .filter(
                (Listing.availability_status.is_(None))
                | (Listing.availability_status == "")
                | (Listing.availability_status == "unknown")
            )
            .limit(limit)
            .all()
        )

        for listing in listings:
            availability_status, is_available = detect_availability_status(
                " ".join([listing.title or "", listing.description or ""])
            )

            if availability_status == "unknown":
                continue

            listing.availability_status = availability_status
            listing.is_available = is_available

        database.commit()
    finally:
        database.close()



def get_database_session():
    database: Session = SessionLocal()

    try:
        yield database
    finally:
        database.close()

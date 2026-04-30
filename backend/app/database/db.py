from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
)

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
}

GEOCODE_CACHE_COLUMN_MIGRATIONS = {
    "provider": "ALTER TABLE geocode_cache ADD COLUMN provider VARCHAR(40)",
    "matched_label": "ALTER TABLE geocode_cache ADD COLUMN matched_label TEXT",
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


def create_database_tables() -> None:
    from app.models import geocode, listing, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_listing_table()
    migrate_geocode_cache_table()
    backfill_existing_listing_locations()


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



def get_database_session():
    database: Session = SessionLocal()

    try:
        yield database
    finally:
        database.close()

from app.scrapers.generic_sources import SourceBlockedError
from app.sources.registry import enabled_sources


def test_sources(city: str = "Breda") -> None:
    for source in enabled_sources(auto_only=True):
        try:
            listings = source.fetch_listings(city)
            status = "success" if listings else "source_returned_empty"
            error = ""
        except SourceBlockedError as blocked_error:
            listings = []
            status = "blocked_or_forbidden"
            error = str(blocked_error)
        except Exception as caught_error:
            listings = []
            status = "parse_error"
            error = str(caught_error)

        print(
            f"{source.display_name}\t{status}\t"
            f"scraped_count={len(listings)}\terror={error}"
        )


if __name__ == "__main__":
    test_sources()

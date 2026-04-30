from app.scrapers.generic_sources import SourceBlockedError
from app.sources.registry import enabled_sources


def test_sources(city: str = "Breda") -> None:
    for source in enabled_sources():
        try:
            listings = source.fetch_listings(city)
            status = "success" if listings else "no_results"
            error = ""
        except SourceBlockedError as blocked_error:
            listings = []
            status = "blocked"
            error = str(blocked_error)
        except Exception as caught_error:
            listings = []
            status = "failed"
            error = str(caught_error)

        print(
            f"{source.display_name}\t{status}\t"
            f"scraped_count={len(listings)}\terror={error}"
        )


if __name__ == "__main__":
    test_sources()

from pathlib import Path
import logging
import random

from playwright.sync_api import sync_playwright

from app.scrapers.runtime_diagnostics import record_fetch, set_metric


logger = logging.getLogger("rentscout.scraper.browser")

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
]


def _looks_like_blocked_page(content: str, status_code: int | None) -> bool:
    if status_code in {401, 403, 429}:
        return True

    lower_content = content.lower()
    blocked_phrases = [
        "access denied",
        "request blocked",
        "403 forbidden",
        "verify you are human",
        "unusual traffic",
        "complete the captcha",
        "captcha challenge",
        "cf-challenge",
        "turnstile challenge",
    ]
    return any(phrase in lower_content for phrase in blocked_phrases)


def fetch_page_with_browser(url: str, debug_name: str = "last_page") -> str | None:
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                channel="chrome",
                headless=True,
            )

            page = browser.new_page(
                user_agent=random.choice(_USER_AGENTS)
            )

            response = page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=30000,
            )

            page.wait_for_timeout(3500)

            content = page.content()
            title = page.title()

            browser.close()

            debug_folder = Path("debug")
            debug_folder.mkdir(exist_ok=True)

            debug_file = debug_folder / f"{debug_name}.html"
            debug_file.write_text(content, encoding="utf-8")
            status_code = response.status if response else None
            response_size = len(content)
            record_fetch(
                url=url,
                status_code=status_code,
                response_size=response_size,
                title=title,
                debug_file=str(debug_file),
            )

            logger.info(
                "browser_fetch_complete debug_name=%s url=%s status=%s title=%s debug_file=%s html_length=%s",
                debug_name,
                url,
                status_code,
                title,
                debug_file,
                response_size,
            )

            if _looks_like_blocked_page(content, status_code):
                set_metric("blocked_detected", True)
                logger.warning(
                    "browser_fetch_blocked debug_name=%s url=%s status=%s",
                    debug_name,
                    url,
                    status_code,
                )
                return None

            return content

    except Exception as error:
        record_fetch(url=url, error=f"{type(error).__name__}: {error}")
        logger.exception("browser_fetch_failed debug_name=%s url=%s", debug_name, url)
        return None

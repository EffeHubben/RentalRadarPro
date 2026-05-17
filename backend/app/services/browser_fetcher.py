from pathlib import Path
import logging
import random

from playwright.sync_api import sync_playwright


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

            page.goto(
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

            logger.info(
                "browser_fetch_complete debug_name=%s title=%s debug_file=%s html_length=%s",
                debug_name,
                title,
                debug_file,
                len(content),
            )

            lower_content = content.lower()

            blocked_keywords = [
                "captcha",
                "access denied",
                "forbidden",
                "verify you are human",
                "unusual traffic",
            ]

            if any(keyword in lower_content for keyword in blocked_keywords):
                logger.warning("browser_fetch_blocked debug_name=%s url=%s", debug_name, url)
                return None

            return content

    except Exception as error:
        logger.exception("browser_fetch_failed debug_name=%s url=%s", debug_name, url)
        return None

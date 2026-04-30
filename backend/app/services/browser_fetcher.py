from pathlib import Path

from playwright.sync_api import sync_playwright


def fetch_page_with_browser(url: str, debug_name: str = "last_page") -> str | None:
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                channel="chrome",
                headless=True,
            )

            page = browser.new_page(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0 Safari/537.36"
                )
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

            print(f"Browser page title: {title}")
            print(f"Saved debug HTML to: {debug_file}")
            print(f"HTML length: {len(content)}")

            lower_content = content.lower()

            blocked_keywords = [
                "captcha",
                "access denied",
                "forbidden",
                "verify you are human",
                "unusual traffic",
            ]

            if any(keyword in lower_content for keyword in blocked_keywords):
                print(f"Browser fetch may be blocked: {url}")
                return None

            return content

    except Exception as error:
        print(f"Browser fetch error for {url}: {error}")
        return None
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.email import (  # noqa: E402
    EmailUserContext,
    render_email_verification_email,
    render_password_reset_email,
    render_payment_failed_email,
    render_pro_activated_email,
    render_subscription_canceled_email,
    render_welcome_email,
)


OUTPUT_DIR = BACKEND_ROOT / "tmp" / "email-previews"


def write_preview(name: str, subject: str, html: str, text: str) -> None:
    html_path = OUTPUT_DIR / f"{name}.html"
    text_path = OUTPUT_DIR / f"{name}.txt"
    html_path.write_text(html, encoding="utf-8")
    text_path.write_text(f"{subject}\n\n{text}", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    english_user = EmailUserContext(
        id=101,
        email="alex@example.com",
        display_name="Alex Morgan",
        preferred_language="en",
    )
    dutch_user = EmailUserContext(
        id=102,
        email="lotte@example.com",
        display_name="Lotte van Dijk",
        preferred_language="nl",
    )

    previews = {
        "welcome-en": render_welcome_email(english_user),
        "welcome-nl": render_welcome_email(dutch_user),
        "pro-activated-en": render_pro_activated_email(english_user),
        "pro-activated-nl": render_pro_activated_email(dutch_user),
        "payment-failed-en": render_payment_failed_email(english_user),
        "payment-failed-nl": render_payment_failed_email(dutch_user),
        "subscription-canceled-en": render_subscription_canceled_email(english_user),
        "subscription-canceled-nl": render_subscription_canceled_email(dutch_user),
        "verify-email-en": render_email_verification_email(english_user, "preview-verification-token"),
        "verify-email-nl": render_email_verification_email(dutch_user, "preview-verification-token"),
        "reset-password-en": render_password_reset_email(english_user, "preview-reset-token"),
        "reset-password-nl": render_password_reset_email(dutch_user, "preview-reset-token"),
    }

    for name, content in previews.items():
        write_preview(name, content.subject, content.html, content.text)

    print(f"Wrote {len(previews)} email previews to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

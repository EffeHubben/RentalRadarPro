import logging
from dataclasses import dataclass
from html import escape

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.database.db import SessionLocal
from app.models.email_delivery import EmailDelivery
from app.models.user import User


logger = logging.getLogger("rentscout.email")


@dataclass(frozen=True)
class EmailUserContext:
    id: int
    email: str
    display_name: str | None
    preferred_language: str | None

    @classmethod
    def from_user(cls, user: User) -> "EmailUserContext":
        return cls(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            preferred_language=user.preferred_language,
        )


def public_app_url() -> str:
    return (settings.app_public_url or settings.frontend_origin).rstrip("/")


def display_name(user: EmailUserContext) -> str:
    return user.display_name.strip() if user.display_name else "there"


def is_dutch(user: EmailUserContext) -> bool:
    return user.preferred_language == "nl"


def greeting(user: EmailUserContext) -> str:
    name = user.display_name.strip() if user.display_name else ""
    prefix = "Hoi" if is_dutch(user) else "Hi"
    return f"{prefix} {escape(name)}," if name else f"{prefix},"


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
) -> str | None:
    if not settings.resend_api_key or not settings.email_from:
        logger.warning(
            "email_skipped_missing_config to=%s subject=%s resend_api_key=%s email_from=%s",
            to,
            subject,
            bool(settings.resend_api_key),
            bool(settings.email_from),
        )
        return None

    try:
        import resend
    except ImportError:
        logger.warning("email_skipped_missing_dependency to=%s subject=%s", to, subject)
        return None

    try:
        resend.api_key = settings.resend_api_key
        response = resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text,
            }
        )
    except Exception:
        logger.exception("email_send_failed to=%s subject=%s", to, subject)
        return None

    if isinstance(response, dict):
        return response.get("id")

    return getattr(response, "id", None)


def send_recorded_email(
    email_type: str,
    event_key: str,
    user: EmailUserContext,
    subject: str,
    html: str,
    text: str,
) -> None:
    database = SessionLocal()

    try:
        existing = database.query(EmailDelivery).filter(EmailDelivery.event_key == event_key).first()

        if existing:
            logger.info("email_skip_duplicate type=%s event_key=%s user_id=%s", email_type, event_key, user.id)
            return

        provider_message_id = send_email(user.email, subject, html, text)

        if not provider_message_id:
            logger.warning("email_not_sent type=%s event_key=%s user_id=%s", email_type, event_key, user.id)
            return

        database.add(
            EmailDelivery(
                user_id=user.id,
                email_type=email_type,
                event_key=event_key,
                provider_message_id=provider_message_id,
            )
        )
        database.commit()
    except IntegrityError:
        database.rollback()
        logger.info("email_duplicate_race type=%s event_key=%s user_id=%s", email_type, event_key, user.id)
    except Exception:
        database.rollback()
        logger.exception("email_record_failed type=%s event_key=%s user_id=%s", email_type, event_key, user.id)
    finally:
        database.close()


def welcome_email_content(user: EmailUserContext) -> tuple[str, str, str]:
    search_url = f"{public_app_url()}/search"

    if is_dutch(user):
        subject = "Welkom bij RentScout"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Bedankt voor je aanmelding bij RentScout. Je account is klaar en je kunt nu direct beginnen met zoeken.</p>"
            f'<p><a href="{search_url}">Open RentScout en start je zoektocht</a></p>'
            "<p>Met vriendelijke groet,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Bedankt voor je aanmelding bij RentScout. Je account is klaar en je kunt nu direct beginnen met zoeken.\n\n"
            f"Open RentScout: {search_url}\n\n"
            "Met vriendelijke groet,\nRentScout"
        )
    else:
        subject = "Welcome to RentScout"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Thanks for joining RentScout. Your account is ready, and you can start searching right away.</p>"
            f'<p><a href="{search_url}">Open RentScout and start your search</a></p>'
            "<p>Best regards,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Thanks for joining RentScout. Your account is ready, and you can start searching right away.\n\n"
            f"Open RentScout: {search_url}\n\n"
            "Best regards,\nRentScout"
        )

    return subject, html, text


def pro_activated_email_content(user: EmailUserContext) -> tuple[str, str, str]:
    account_url = f"{public_app_url()}/account"
    search_url = f"{public_app_url()}/search"

    if is_dutch(user):
        subject = "Je RentScout Pro-abonnement is actief"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Je RentScout Pro-toegang is nu actief. Je kunt volledige woningdetails, meldingen en je Pro-functies meteen gebruiken.</p>"
            f'<p><a href="{search_url}">Open je zoekdashboard</a> of <a href="{account_url}">beheer je account</a>.</p>'
            "<p>Met vriendelijke groet,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Je RentScout Pro-toegang is nu actief. Je kunt volledige woningdetails, meldingen en je Pro-functies meteen gebruiken.\n\n"
            f"Zoekdashboard: {search_url}\n"
            f"Account: {account_url}\n\n"
            "Met vriendelijke groet,\nRentScout"
        )
    else:
        subject = "Your RentScout Pro plan is active"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Your RentScout Pro access is now active. You can use full listing details, alerts, and the rest of your Pro features immediately.</p>"
            f'<p><a href="{search_url}">Open your search dashboard</a> or <a href="{account_url}">manage your account</a>.</p>'
            "<p>Best regards,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Your RentScout Pro access is now active. You can use full listing details, alerts, and the rest of your Pro features immediately.\n\n"
            f"Search dashboard: {search_url}\n"
            f"Account: {account_url}\n\n"
            "Best regards,\nRentScout"
        )

    return subject, html, text


def payment_failed_email_content(user: EmailUserContext) -> tuple[str, str, str]:
    account_url = f"{public_app_url()}/account"

    if is_dutch(user):
        subject = "Actie nodig: je RentScout-betaling is mislukt"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>We konden je laatste betaling voor RentScout Pro niet verwerken. Werk je betaalmethode bij om onderbreking van je Pro-toegang te voorkomen.</p>"
            f'<p><a href="{account_url}">Open je account en werk je abonnement bij</a>.</p>'
            "<p>Met vriendelijke groet,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "We konden je laatste betaling voor RentScout Pro niet verwerken. Werk je betaalmethode bij om onderbreking van je Pro-toegang te voorkomen.\n\n"
            f"Account: {account_url}\n\n"
            "Met vriendelijke groet,\nRentScout"
        )
    else:
        subject = "Action needed: your RentScout payment failed"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>We could not process your latest RentScout Pro payment. Please update your payment method to avoid interruption to your Pro access.</p>"
            f'<p><a href="{account_url}">Open your account and update your subscription</a>.</p>'
            "<p>Best regards,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "We could not process your latest RentScout Pro payment. Please update your payment method to avoid interruption to your Pro access.\n\n"
            f"Account: {account_url}\n\n"
            "Best regards,\nRentScout"
        )

    return subject, html, text


def subscription_canceled_email_content(user: EmailUserContext) -> tuple[str, str, str]:
    account_url = f"{public_app_url()}/account"
    search_url = f"{public_app_url()}/search"

    if is_dutch(user):
        subject = "Je RentScout Pro-abonnement is geannuleerd"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Je RentScout Pro-abonnement is geannuleerd. Je account kan terugvallen naar Gratis zodra je huidige betaalperiode eindigt of wanneer Stripe de annulering verwerkt.</p>"
            f'<p><a href="{account_url}">Bekijk je account</a> of <a href="{search_url}">ga terug naar zoeken</a>.</p>'
            "<p>Met vriendelijke groet,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Je RentScout Pro-abonnement is geannuleerd. Je account kan terugvallen naar Gratis zodra je huidige betaalperiode eindigt of wanneer Stripe de annulering verwerkt.\n\n"
            f"Account: {account_url}\n"
            f"Zoeken: {search_url}\n\n"
            "Met vriendelijke groet,\nRentScout"
        )
    else:
        subject = "Your RentScout Pro subscription was canceled"
        html = (
            f"<p>{greeting(user)}</p>"
            "<p>Your RentScout Pro subscription was canceled. Your account may return to Free when your current billing period ends or once Stripe finishes processing the cancellation.</p>"
            f'<p><a href="{account_url}">View your account</a> or <a href="{search_url}">return to search</a>.</p>'
            "<p>Best regards,<br>RentScout</p>"
        )
        text = (
            f"{greeting(user).rstrip(',')},\n\n"
            "Your RentScout Pro subscription was canceled. Your account may return to Free when your current billing period ends or once Stripe finishes processing the cancellation.\n\n"
            f"Account: {account_url}\n"
            f"Search: {search_url}\n\n"
            "Best regards,\nRentScout"
        )

    return subject, html, text


def send_welcome_email(user: EmailUserContext, event_key: str | None = None) -> None:
    subject, html, text = welcome_email_content(user)
    send_recorded_email("welcome", event_key or f"welcome:user:{user.id}", user, subject, html, text)


def send_pro_activated_email(user: EmailUserContext, event_key: str | None = None) -> None:
    subject, html, text = pro_activated_email_content(user)
    send_recorded_email("pro_activated", event_key or f"pro_activated:user:{user.id}", user, subject, html, text)


def send_payment_failed_email(user: EmailUserContext, event_key: str | None = None) -> None:
    subject, html, text = payment_failed_email_content(user)
    send_recorded_email("payment_failed", event_key or f"payment_failed:user:{user.id}", user, subject, html, text)


def send_subscription_canceled_email(user: EmailUserContext, event_key: str | None = None) -> None:
    subject, html, text = subscription_canceled_email_content(user)
    send_recorded_email(
        "subscription_canceled",
        event_key or f"subscription_canceled:user:{user.id}",
        user,
        subject,
        html,
        text,
    )

import logging
from dataclasses import dataclass
from html import escape
from typing import Literal

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.database.db import SessionLocal
from app.models.email_delivery import EmailDelivery
from app.models.user import User


logger = logging.getLogger("rentscout.email")
EmailLocale = Literal["en", "nl"]

BRAND = {
    "page_background": "#f6f0e6",
    "card_background": "#fffdf9",
    "card_border": "#e8dcc8",
    "text_primary": "#24211d",
    "text_muted": "#6a6257",
    "accent": "#b6893a",
    "accent_dark": "#8e6829",
    "button_text": "#1f1a14",
    "divider": "#efe4d2",
}


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


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html: str
    text: str


def public_app_url() -> str:
    return (settings.app_public_url or settings.frontend_origin).rstrip("/")


def build_public_url(path: str) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{public_app_url()}{normalized_path}"


def get_user_locale(user: EmailUserContext) -> EmailLocale:
    return "nl" if user.preferred_language == "nl" else "en"


def first_name(user: EmailUserContext) -> str | None:
    if not user.display_name:
        return None

    normalized = " ".join(user.display_name.split()).strip()

    if not normalized:
        return None

    return normalized.split(" ", 1)[0]


def greeting(user: EmailUserContext, locale: EmailLocale) -> str:
    name = first_name(user)

    if locale == "nl":
        return f"Hoi {escape(name)}," if name else "Hoi,"

    return f"Hi {escape(name)}," if name else "Hi there,"


def text_greeting(user: EmailUserContext, locale: EmailLocale) -> str:
    name = first_name(user)

    if locale == "nl":
        return f"Hoi {name}," if name else "Hoi,"

    return f"Hi {name}," if name else "Hi there,"


def render_button(label: str, url: str) -> str:
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">'
        "<tr>"
        f'<td align="center" bgcolor="{BRAND["accent"]}" style="border-radius:999px;">'
        f'<a href="{escape(url)}" '
        'style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:15px;font-weight:700;line-height:20px;color:{BRAND["button_text"]};'
        'text-decoration:none;border-radius:999px;">'
        f"{escape(label)}"
        "</a>"
        "</td>"
        "</tr>"
        "</table>"
    )


def render_footer(locale: EmailLocale) -> str:
    support_line = (
        "Hulp nodig? Beantwoord deze e-mail en we helpen je verder."
        if locale == "nl"
        else "Need help? Reply to this email and we will help."
    )
    website_label = "RentScout website" if locale == "en" else "RentScout website"
    website_url = public_app_url()

    return (
        f'<p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;'
        f'line-height:20px;color:{BRAND["text_muted"]};">{escape(support_line)}</p>'
        f'<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;'
        f'line-height:20px;color:{BRAND["text_muted"]};">'
        f'<a href="{escape(website_url)}" style="color:{BRAND["accent_dark"]};text-decoration:underline;">'
        f"{escape(website_label)}"
        "</a>"
        "</p>"
    )


def render_plain_text_footer(locale: EmailLocale) -> str:
    support_line = (
        "Hulp nodig? Beantwoord deze e-mail en we helpen je verder."
        if locale == "nl"
        else "Need help? Reply to this email and we will help."
    )
    return f"{support_line}\n{public_app_url()}\n\nRentScout"


def render_email_layout(
    *,
    locale: EmailLocale,
    title: str,
    preheader: str,
    greeting_line: str,
    body_lines: list[str],
    cta_label: str,
    cta_url: str,
    eyebrow: str = "RentScout",
    after_cta_lines: list[str] | None = None,
) -> str:
    body_html = "".join(
        f'<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;'
        f'color:{BRAND["text_primary"]};">{escape(line)}</p>'
        for line in body_lines
    )
    after_cta_html = "".join(
        f'<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;'
        f'color:{BRAND["text_muted"]};">{escape(line)}</p>'
        for line in (after_cta_lines or [])
    )
    fallback_copy = (
        "Werkt de knop niet? Kopieer en plak deze link in je browser:"
        if locale == "nl"
        else "If the button does not work, copy and paste this link into your browser:"
    )

    return (
        "<!doctype html>"
        '<html lang="{}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
        '<body style="margin:0;padding:0;background-color:{};">'
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{}</div>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color:{};margin:0;padding:0;">'
        "<tr><td align=\"center\" style=\"padding:28px 16px;\">"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width:640px;margin:0 auto;">'
        "<tr><td>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color:{};border:1px solid {};border-radius:24px;">'
        "<tr><td style=\"padding:32px 32px 24px 32px;\">"
        f'<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;'
        f'letter-spacing:0.18em;text-transform:uppercase;color:{BRAND["accent_dark"]};font-weight:700;">{escape(eyebrow)}</p>'
        f'<h1 style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:38px;'
        f'font-weight:700;color:{BRAND["text_primary"]};">{escape(title)}</h1>'
        f'<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;'
        f'color:{BRAND["text_primary"]};">{greeting_line}</p>'
        f"{body_html}"
        '<div style="padding:10px 0 6px 0;text-align:center;">'
        f"{render_button(cta_label, cta_url)}"
        "</div>"
        f'<p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:22px;'
        f'color:{BRAND["text_muted"]};text-align:center;">{escape(fallback_copy)}</p>'
        f'<p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:22px;'
        f'text-align:center;word-break:break-all;">'
        f'<a href="{escape(cta_url)}" style="color:{BRAND["accent_dark"]};text-decoration:underline;">{escape(cta_url)}</a>'
        "</p>"
        f"{after_cta_html}"
        "</td></tr>"
        "<tr><td style=\"padding:0 32px 0 32px;\">"
        f'<div style="height:1px;background-color:{BRAND["divider"]};line-height:1px;font-size:1px;">&nbsp;</div>'
        "</td></tr>"
        "<tr><td style=\"padding:22px 32px 30px 32px;\">"
        f"{render_footer(locale)}"
        "</td></tr>"
        "</table>"
        "</td></tr>"
        "</table>"
        "</td></tr>"
        "</table>"
        "</body></html>"
    ).format(
        locale,
        BRAND["page_background"],
        escape(preheader),
        BRAND["page_background"],
        BRAND["card_background"],
        BRAND["card_border"],
    )


def render_plain_text_email(
    *,
    locale: EmailLocale,
    title: str,
    greeting_line: str,
    body_lines: list[str],
    cta_label: str,
    cta_url: str,
    after_cta_lines: list[str] | None = None,
) -> str:
    sections = [
        greeting_line.rstrip(","),
        "",
        title,
        "",
        *body_lines,
        "",
        f"{cta_label}: {cta_url}",
    ]

    if after_cta_lines:
        sections.extend(["", *after_cta_lines])

    sections.extend(["", render_plain_text_footer(locale)])
    return "\n".join(sections)


def render_welcome_email(user: EmailUserContext) -> EmailContent:
    locale = get_user_locale(user)
    search_url = build_public_url("/search")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Welkom bij RentScout"
        body_lines = [
            "Je account is klaar. Je kunt nu direct beginnen met zoeken en woningen rustig naast elkaar vergelijken.",
            "RentScout brengt huuradvertenties samen in een kalmer overzicht, zodat je sneller ziet wat echt relevant is.",
        ]
        cta_label = "Open RentScout"
        after_cta_lines = ["Je kunt op elk moment terug naar zoeken of je account vanuit dezelfde omgeving."]
    else:
        title = "Welcome to RentScout"
        body_lines = [
            "Your account is ready. You can start searching and comparing rental listings right away.",
            "RentScout brings listings into one calmer overview, so it is easier to focus on the homes that matter.",
        ]
        cta_label = "Open RentScout"
        after_cta_lines = ["You can return to search or your account from the same focused workspace."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=search_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=search_url,
            after_cta_lines=after_cta_lines,
        ),
    )


def render_pro_activated_email(user: EmailUserContext) -> EmailContent:
    locale = get_user_locale(user)
    account_url = build_public_url("/account")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Je RentScout Pro-abonnement is actief"
        body_lines = [
            "Je Pro-toegang is nu actief.",
            "Je kunt nu volledige woningdetails en de premium onderdelen gebruiken die al in je account beschikbaar zijn.",
        ]
        cta_label = "Bekijk je account"
        after_cta_lines = ["Open je account om je abonnement en beschikbare Pro-toegang te bekijken."]
    else:
        title = "Your RentScout Pro plan is active"
        body_lines = [
            "Your Pro access is now active.",
            "You can now use full listing details and the premium parts of RentScout that are already available in your account.",
        ]
        cta_label = "View your account"
        after_cta_lines = ["Open your account to review your subscription and available Pro access."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=account_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=account_url,
            after_cta_lines=after_cta_lines,
        ),
    )


def render_payment_failed_email(user: EmailUserContext) -> EmailContent:
    locale = get_user_locale(user)
    account_url = build_public_url("/account")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Actie nodig: je RentScout-betaling is mislukt"
        body_lines = [
            "We konden je laatste betaling niet verwerken.",
            "Werk je betaalmethode bij om te voorkomen dat je Pro-toegang wordt gepauzeerd als het probleem blijft bestaan.",
        ]
        cta_label = "Betaalmethode bijwerken"
        after_cta_lines = ["Open je account om je abonnement te controleren en je betaalgegevens bij te werken."]
    else:
        title = "Action needed: your RentScout payment failed"
        body_lines = [
            "We could not complete your latest payment.",
            "Please update your payment method to avoid your Pro access being paused if the issue continues.",
        ]
        cta_label = "Update payment method"
        after_cta_lines = ["Open your account to review your subscription and update your payment details."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=account_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=account_url,
            after_cta_lines=after_cta_lines,
        ),
    )


def render_subscription_canceled_email(user: EmailUserContext) -> EmailContent:
    locale = get_user_locale(user)
    pricing_url = build_public_url("/#pricing")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Je RentScout Pro-abonnement is geannuleerd"
        body_lines = [
            "Je abonnement is geannuleerd.",
            "Je account kan verder op Free en je kunt Pro op elk moment opnieuw activeren wanneer dat weer past.",
        ]
        cta_label = "Bekijk abonnementen"
        after_cta_lines = ["Open de abonnementen om Pro opnieuw te activeren wanneer je weer meer toegang wilt."]
    else:
        title = "Your RentScout Pro subscription was canceled"
        body_lines = [
            "Your subscription was canceled.",
            "Your account can continue on Free, and you can reactivate Pro any time if you want the extra access again.",
        ]
        cta_label = "View plans"
        after_cta_lines = ["Open the plans section if you want to reactivate Pro later."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=pricing_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=pricing_url,
            after_cta_lines=after_cta_lines,
        ),
    )


def render_email_verification_email(user: EmailUserContext, token: str) -> EmailContent:
    locale = get_user_locale(user)
    verification_url = build_public_url(f"/verify-email?token={token}")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Bevestig je RentScout e-mailadres"
        body_lines = [
            "Bevestig je e-mailadres om je accountgegevens up-to-date te houden en belangrijke accountmails te blijven ontvangen.",
            "Deze stap blokkeert je account nu nog niet, maar helpt straks bij veiligere accountacties.",
        ]
        cta_label = "E-mailadres bevestigen"
        after_cta_lines = ["Als je deze aanmelding niet herkent, kun je deze e-mail verder negeren."]
    else:
        title = "Verify your RentScout email"
        body_lines = [
            "Verify your email address so your account stays up to date and you keep receiving important account messages.",
            "This does not block your account today, but it prepares the account for safer recovery flows later.",
        ]
        cta_label = "Verify email"
        after_cta_lines = ["If you do not recognize this sign-up, you can ignore this email."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=verification_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=verification_url,
            after_cta_lines=after_cta_lines,
        ),
    )


def render_password_reset_email(user: EmailUserContext, token: str) -> EmailContent:
    locale = get_user_locale(user)
    reset_url = build_public_url(f"/reset-password?token={token}")
    greeting_line = greeting(user, locale)
    text_line = text_greeting(user, locale)

    if locale == "nl":
        title = "Reset je RentScout-wachtwoord"
        body_lines = [
            "We hebben een verzoek ontvangen om je wachtwoord te resetten.",
            "Gebruik de knop hieronder om een nieuw wachtwoord in te stellen. Als jij dit niet was, kun je deze e-mail negeren.",
        ]
        cta_label = "Wachtwoord resetten"
        after_cta_lines = ["De resetlink verloopt automatisch voor extra veiligheid."]
    else:
        title = "Reset your RentScout password"
        body_lines = [
            "We received a request to reset your password.",
            "Use the button below to set a new password. If this was not you, you can ignore this email.",
        ]
        cta_label = "Reset password"
        after_cta_lines = ["The reset link expires automatically for extra safety."]

    return EmailContent(
        subject=title,
        html=render_email_layout(
            locale=locale,
            title=title,
            preheader=body_lines[0],
            greeting_line=greeting_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=reset_url,
            after_cta_lines=after_cta_lines,
        ),
        text=render_plain_text_email(
            locale=locale,
            title=title,
            greeting_line=text_line,
            body_lines=body_lines,
            cta_label=cta_label,
            cta_url=reset_url,
            after_cta_lines=after_cta_lines,
        ),
    )


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


def send_welcome_email(user: EmailUserContext, event_key: str | None = None) -> None:
    content = render_welcome_email(user)
    send_recorded_email("welcome", event_key or f"welcome:user:{user.id}", user, content.subject, content.html, content.text)


def send_pro_activated_email(user: EmailUserContext, event_key: str | None = None) -> None:
    content = render_pro_activated_email(user)
    send_recorded_email(
        "pro_activated",
        event_key or f"pro_activated:user:{user.id}",
        user,
        content.subject,
        content.html,
        content.text,
    )


def send_payment_failed_email(user: EmailUserContext, event_key: str | None = None) -> None:
    content = render_payment_failed_email(user)
    send_recorded_email(
        "payment_failed",
        event_key or f"payment_failed:user:{user.id}",
        user,
        content.subject,
        content.html,
        content.text,
    )


def send_subscription_canceled_email(user: EmailUserContext, event_key: str | None = None) -> None:
    content = render_subscription_canceled_email(user)
    send_recorded_email(
        "subscription_canceled",
        event_key or f"subscription_canceled:user:{user.id}",
        user,
        content.subject,
        content.html,
        content.text,
    )


def send_email_verification_email(user: EmailUserContext, token: str, event_key: str) -> None:
    content = render_email_verification_email(user, token)
    send_recorded_email("email_verification", event_key, user, content.subject, content.html, content.text)


def send_password_reset_email(user: EmailUserContext, token: str, event_key: str) -> None:
    content = render_password_reset_email(user, token)
    send_recorded_email("password_reset", event_key, user, content.subject, content.html, content.text)

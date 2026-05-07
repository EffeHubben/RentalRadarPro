from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.database.db import get_database_session
from app.models.user import User


router = APIRouter(prefix="/api/billing", tags=["Billing"])

PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}
FREE_SUBSCRIPTION_STATUSES = {"canceled", "incomplete_expired", "unpaid"}


def get_stripe():
    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not installed on this server",
        ) from exc

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe billing is not configured",
        )

    stripe.api_key = settings.stripe_secret_key
    return stripe


def require_setting(value: str | None, name: str) -> str:
    if not value:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{name} is not configured",
        )

    return value


def billing_is_configured() -> bool:
    return all(
        [
            settings.stripe_secret_key,
            settings.stripe_webhook_secret,
            settings.stripe_price_id_pro,
            settings.billing_success_url,
            settings.billing_cancel_url,
        ]
    )


def require_billing_configured() -> None:
    if not billing_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe billing is not fully configured",
        )


def stripe_value(data: Any, key: str, default: Any = None) -> Any:
    if data is None:
        return default

    if isinstance(data, dict):
        return data.get(key, default)

    return getattr(data, key, default)


def timestamp_to_datetime(value: int | float | None) -> datetime | None:
    if value is None:
        return None

    return datetime.utcfromtimestamp(value)


def find_user_for_stripe_object(database: Session, data: Any) -> User | None:
    metadata = stripe_value(data, "metadata") or {}
    user_id = metadata.get("user_id") if isinstance(metadata, dict) else None
    customer_id = stripe_value(data, "customer")
    subscription_id = stripe_value(data, "subscription") or stripe_value(data, "id")

    query = database.query(User)

    if user_id:
        user = query.filter(User.id == int(user_id)).first()

        if user:
            return user

    filters = []

    if customer_id:
        filters.append(User.stripe_customer_id == str(customer_id))

    if subscription_id:
        filters.append(User.stripe_subscription_id == str(subscription_id))

    if not filters:
        return None

    return query.filter(or_(*filters)).first()


def apply_subscription_state(user: User, subscription: Any) -> None:
    subscription_status = stripe_value(subscription, "status") or "inactive"
    subscription_id = stripe_value(subscription, "id")
    customer_id = stripe_value(subscription, "customer")

    if customer_id:
        user.stripe_customer_id = str(customer_id)

    if subscription_id:
        user.stripe_subscription_id = str(subscription_id)

    user.subscription_status = subscription_status
    user.subscription_current_period_end = timestamp_to_datetime(
        stripe_value(subscription, "current_period_end")
    )
    user.plan = "pro" if subscription_status in PRO_SUBSCRIPTION_STATUSES else "free"


def apply_checkout_session(database: Session, session: Any) -> User | None:
    user = find_user_for_stripe_object(database, session)

    if not user:
        return None

    customer_id = stripe_value(session, "customer")
    subscription_id = stripe_value(session, "subscription")

    if customer_id:
        user.stripe_customer_id = str(customer_id)

    if subscription_id:
        user.stripe_subscription_id = str(subscription_id)

    return user


def clear_subscription_state(user: User, subscription: Any) -> None:
    customer_id = stripe_value(subscription, "customer")
    subscription_id = stripe_value(subscription, "id")

    if customer_id:
        user.stripe_customer_id = str(customer_id)

    if subscription_id:
        user.stripe_subscription_id = str(subscription_id)

    user.plan = "free"
    user.subscription_status = stripe_value(subscription, "status") or "canceled"
    user.subscription_current_period_end = timestamp_to_datetime(
        stripe_value(subscription, "current_period_end")
    )


@router.get("/config")
def get_billing_config():
    return {"billing_enabled": billing_is_configured()}


@router.post("/create-checkout-session")
def create_checkout_session(
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    require_billing_configured()
    stripe = get_stripe()
    price_id = require_setting(settings.stripe_price_id_pro, "STRIPE_PRICE_ID_PRO")
    success_url = require_setting(settings.billing_success_url, "BILLING_SUCCESS_URL")
    cancel_url = require_setting(settings.billing_cancel_url, "BILLING_CANCEL_URL")

    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        database.commit()
        database.refresh(current_user)

    session = stripe.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=str(current_user.id),
        metadata={
            "user_id": str(current_user.id),
            "email": current_user.email,
        },
        subscription_data={
            "metadata": {
                "user_id": str(current_user.id),
                "email": current_user.email,
            }
        },
    )

    return {"url": session.url}


@router.post("/create-portal-session")
def create_portal_session(
    current_user: User = Depends(get_current_user),
):
    require_billing_configured()
    stripe = get_stripe()

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer is linked to this account",
        )

    return_url = require_setting(settings.billing_success_url, "BILLING_SUCCESS_URL")
    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=return_url,
    )

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    database: Session = Depends(get_database_session),
):
    stripe = get_stripe()
    webhook_secret = require_setting(settings.stripe_webhook_secret, "STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(payload, signature, webhook_secret)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook") from exc

    event_type = stripe_value(event, "type")
    data_object = stripe_value(stripe_value(event, "data") or {}, "object")

    if event_type == "checkout.session.completed":
        user = apply_checkout_session(database, data_object)
        subscription_id = stripe_value(data_object, "subscription")

        if user and subscription_id:
            subscription = stripe.Subscription.retrieve(subscription_id)
            apply_subscription_state(user, subscription)

    elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
        user = find_user_for_stripe_object(database, data_object)

        if user:
            apply_subscription_state(user, data_object)

    elif event_type == "customer.subscription.deleted":
        user = find_user_for_stripe_object(database, data_object)

        if user:
            clear_subscription_state(user, data_object)

    elif event_type == "invoice.paid":
        subscription_id = stripe_value(data_object, "subscription")

        if subscription_id:
            subscription = stripe.Subscription.retrieve(subscription_id)
            user = find_user_for_stripe_object(database, subscription)

            if user:
                apply_subscription_state(user, subscription)

    elif event_type == "invoice.payment_failed":
        subscription_id = stripe_value(data_object, "subscription")

        if subscription_id:
            subscription = stripe.Subscription.retrieve(subscription_id)
            user = find_user_for_stripe_object(database, subscription)

            if user:
                apply_subscription_state(user, subscription)
        else:
            user = find_user_for_stripe_object(database, data_object)

            if user and user.subscription_status not in FREE_SUBSCRIPTION_STATUSES:
                user.subscription_status = "past_due"
                user.plan = "free"

    database.commit()

    return {"received": True}

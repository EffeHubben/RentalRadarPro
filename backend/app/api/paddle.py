import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.database.db import get_database_session
from app.models.user import PaddleEvent, User


router = APIRouter(prefix="/api/billing/paddle", tags=["Billing"])
logger = logging.getLogger("rentscout.billing.paddle")


PLAN_TO_DURATION_MONTHS = {"1m": 1, "2m": 2, "3m": 3}

# Maps plan keys to the env var name (not the value) used for safe logging.
PLAN_TO_PRICE_ENV_NAME = {
    "1m": "PADDLE_PRO_1M_PRICE_ID",
    "2m": "PADDLE_PRO_2M_PRICE_ID",
    "3m": "PADDLE_PRO_3M_PRICE_ID",
}

# Subscription model: the three Paddle prices referenced by the env vars are
# recurring prices (€14.99 / 1 month, €24.99 / 2 months, €34.99 / 3 months).
# Pro access is granted via subscription_status (active/trialing) and revoked
# when Paddle marks the subscription canceled past its paid-through date.

PRO_STATUSES = {"active", "trialing"}


def paddle_api_base_url() -> str:
    env = (settings.paddle_env or "sandbox").strip().lower()
    if env == "production":
        return "https://api.paddle.com"
    return "https://sandbox-api.paddle.com"


def require_paddle_configured() -> None:
    if (settings.payment_provider or "").strip().lower() != "paddle":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Paddle billing is not the active payment provider",
        )
    if not settings.paddle_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PADDLE_API_KEY is not configured",
        )


def price_id_for_plan(plan: str) -> str:
    mapping = {
        "1m": settings.paddle_pro_1m_price_id,
        "2m": settings.paddle_pro_2m_price_id,
        "3m": settings.paddle_pro_3m_price_id,
    }
    price_id = mapping.get(plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"PADDLE_PRO_{plan.upper()}_PRICE_ID is not configured",
        )
    return price_id


class CreateCheckoutRequest(BaseModel):
    plan: Literal["1m", "2m", "3m"] = Field(...)


class CreateCheckoutResponse(BaseModel):
    transaction_id: str
    checkout_url: str | None
    plan: str
    duration_months: int


class ManageSubscriptionResponse(BaseModel):
    cancel_url: str | None
    update_payment_method_url: str | None


def _paddle_request(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{paddle_api_base_url()}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request_obj = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {settings.paddle_api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request_obj, timeout=20) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        logger.error("paddle_api_error status=%s body=%s", exc.code, body_text[:500])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle API request failed",
        ) from exc
    except urllib.error.URLError as exc:
        logger.exception("paddle_api_unreachable")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle API unreachable",
        ) from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.exception("paddle_api_invalid_json")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle returned invalid JSON",
        ) from exc


@router.post("/create-checkout", response_model=CreateCheckoutResponse)
def create_paddle_checkout(
    payload: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
) -> CreateCheckoutResponse:
    require_paddle_configured()

    price_id = price_id_for_plan(payload.plan)
    duration_months = PLAN_TO_DURATION_MONTHS[payload.plan]
    price_env_name = PLAN_TO_PRICE_ENV_NAME[payload.plan]

    logger.info(
        "paddle_create_checkout_request user_id=%s plan=%s duration_months=%s price_env=%s",
        current_user.id,
        payload.plan,
        duration_months,
        price_env_name,
    )

    transaction_body: dict[str, Any] = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "custom_data": {
            "user_id": str(current_user.id),
            "duration_months": duration_months,
            "provider": "paddle",
            "product": "rentscout_pro_subscription",
            "plan": payload.plan,
        },
    }

    if current_user.paddle_customer_id:
        transaction_body["customer_id"] = current_user.paddle_customer_id

    response = _paddle_request("POST", "/transactions", transaction_body)
    data = response.get("data") or {}
    transaction_id = data.get("id")

    if not transaction_id:
        logger.error("paddle_create_transaction_missing_id response_keys=%s", list(response.keys()))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle did not return a transaction id",
        )

    checkout = data.get("checkout") or {}
    checkout_url = checkout.get("url") if isinstance(checkout, dict) else None

    logger.info(
        "paddle_create_checkout_success user_id=%s plan=%s duration_months=%s price_env=%s transaction_id=%s",
        current_user.id,
        payload.plan,
        duration_months,
        price_env_name,
        transaction_id,
    )

    customer_id = data.get("customer_id")
    if customer_id and not current_user.paddle_customer_id:
        stored = database.query(User).filter(User.id == current_user.id).first()
        if stored:
            stored.paddle_customer_id = str(customer_id)
            database.commit()

    return CreateCheckoutResponse(
        transaction_id=str(transaction_id),
        checkout_url=checkout_url,
        plan=payload.plan,
        duration_months=duration_months,
    )


@router.get("/manage", response_model=ManageSubscriptionResponse)
def get_manage_subscription(
    current_user: User = Depends(get_current_user),
) -> ManageSubscriptionResponse:
    require_paddle_configured()

    subscription_id = current_user.paddle_subscription_id
    if not subscription_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Paddle subscription is linked to this account",
        )

    response = _paddle_request("GET", f"/subscriptions/{subscription_id}")
    data = response.get("data") or {}
    management_urls = data.get("management_urls") or {}

    return ManageSubscriptionResponse(
        cancel_url=management_urls.get("cancel"),
        update_payment_method_url=management_urls.get("update_payment_method"),
    )


def verify_paddle_signature(signature_header: str, raw_body: bytes, secret: str) -> bool:
    if not signature_header or not secret:
        return False

    parts: dict[str, list[str]] = {}
    for chunk in signature_header.split(";"):
        chunk = chunk.strip()
        if not chunk or "=" not in chunk:
            continue
        key, _, value = chunk.partition("=")
        parts.setdefault(key.strip(), []).append(value.strip())

    timestamp_values = parts.get("ts")
    signature_values = parts.get("h1")
    if not timestamp_values or not signature_values:
        return False

    timestamp = timestamp_values[0]
    signed_payload = f"{timestamp}:".encode("utf-8") + raw_body
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    return any(hmac.compare_digest(expected, candidate) for candidate in signature_values)


def _parse_paddle_datetime(value: Any) -> datetime | None:
    """Parse a Paddle ISO-8601 timestamp (e.g. '2026-06-01T10:00:00Z')."""
    if not value or not isinstance(value, str):
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).replace(tzinfo=None)
    except ValueError:
        return None


def _subscription_period_end(subscription: dict[str, Any]) -> datetime | None:
    period = subscription.get("current_billing_period") or {}
    if isinstance(period, dict):
        end = _parse_paddle_datetime(period.get("ends_at"))
        if end:
            return end

    scheduled = subscription.get("scheduled_change") or {}
    if isinstance(scheduled, dict):
        effective = _parse_paddle_datetime(scheduled.get("effective_at"))
        if effective:
            return effective

    return _parse_paddle_datetime(subscription.get("next_billed_at"))


def _find_user_for_subscription(database: Session, subscription: dict[str, Any]) -> User | None:
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer_id")
    custom_data = subscription.get("custom_data") or {}
    user_id_raw = custom_data.get("user_id") if isinstance(custom_data, dict) else None

    if user_id_raw:
        try:
            user = database.query(User).filter(User.id == int(user_id_raw)).first()
        except (TypeError, ValueError):
            user = None
        if user:
            return user

    if subscription_id:
        user = (
            database.query(User)
            .filter(User.paddle_subscription_id == str(subscription_id))
            .first()
        )
        if user:
            return user

    if customer_id:
        user = (
            database.query(User)
            .filter(User.paddle_customer_id == str(customer_id))
            .first()
        )
        if user:
            return user

    return None


def _apply_subscription_state(user: User, subscription: dict[str, Any]) -> None:
    """Update user fields from a Paddle subscription payload."""
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer_id")
    sub_status = (subscription.get("status") or "").lower() or "inactive"
    period_end = _subscription_period_end(subscription)
    scheduled = subscription.get("scheduled_change") or {}
    scheduled_action = (
        scheduled.get("action") if isinstance(scheduled, dict) else None
    )

    if subscription_id:
        user.paddle_subscription_id = str(subscription_id)
    if customer_id:
        user.paddle_customer_id = str(customer_id)

    user.billing_provider = "paddle"
    user.subscription_status = sub_status
    user.subscription_current_period_end = period_end
    user.subscription_cancel_at_period_end = scheduled_action == "cancel"

    grants_pro = sub_status in PRO_STATUSES or (
        sub_status == "canceled" and period_end is not None and period_end > datetime.utcnow()
    )
    user.plan = "pro" if grants_pro else "free"

    if period_end is not None and grants_pro:
        user.pro_expires_at = period_end


def _handle_transaction_completed(
    database: Session, data: dict[str, Any], event_id: str | None
) -> dict[str, Any]:
    transaction_id = data.get("id")
    if not transaction_id:
        return {"received": True, "ignored": "missing transaction id"}

    existing_event = (
        database.query(PaddleEvent)
        .filter(PaddleEvent.transaction_id == str(transaction_id))
        .first()
    )
    if existing_event is not None:
        return {"received": True, "duplicate": True}

    custom_data = data.get("custom_data") or {}
    user_id_raw = custom_data.get("user_id") if isinstance(custom_data, dict) else None

    try:
        user_id = int(user_id_raw) if user_id_raw is not None else None
    except (TypeError, ValueError):
        user_id = None

    user: User | None = None
    if user_id is not None:
        user = database.query(User).filter(User.id == user_id).first()

    if user is None:
        customer_id = data.get("customer_id")
        if customer_id:
            user = (
                database.query(User)
                .filter(User.paddle_customer_id == str(customer_id))
                .first()
            )

    if user is None:
        logger.warning(
            "paddle_webhook_transaction_unknown_user transaction_id=%s",
            transaction_id,
        )
        return {"received": True, "ignored": "unknown user"}

    customer_id = data.get("customer_id")
    if customer_id:
        user.paddle_customer_id = str(customer_id)

    subscription_id = data.get("subscription_id")
    if subscription_id:
        user.paddle_subscription_id = str(subscription_id)

    user.paddle_transaction_id = str(transaction_id)
    user.billing_provider = "paddle"

    # If we get the subscription id, fetch it so the state matches subscription truth.
    if subscription_id and settings.paddle_api_key:
        try:
            sub_response = _paddle_request("GET", f"/subscriptions/{subscription_id}")
            sub_data = sub_response.get("data") or {}
            if sub_data:
                _apply_subscription_state(user, sub_data)
        except HTTPException:
            # Don't fail the webhook if the API lookup hiccups; activate Pro optimistically.
            user.plan = "pro"
            if user.subscription_status not in PRO_STATUSES:
                user.subscription_status = "active"
    else:
        user.plan = "pro"
        if user.subscription_status not in PRO_STATUSES:
            user.subscription_status = "active"

    database.add(
        PaddleEvent(
            event_id=str(event_id) if event_id else None,
            transaction_id=str(transaction_id),
            event_type="transaction.completed",
            user_id=user.id,
        )
    )
    database.commit()
    return {"received": True}


SUBSCRIPTION_EVENT_TYPES = {
    "subscription.created",
    "subscription.activated",
    "subscription.updated",
    "subscription.canceled",
    "subscription.paused",
    "subscription.past_due",
    "subscription.resumed",
    "subscription.trialing",
}


@router.post("/webhook")
async def paddle_webhook(
    request: Request,
    database: Session = Depends(get_database_session),
):
    secret = settings.paddle_webhook_secret_key
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PADDLE_WEBHOOK_SECRET_KEY is not configured",
        )

    raw_body = await request.body()
    signature_header = request.headers.get("paddle-signature", "")

    if not verify_paddle_signature(signature_header, raw_body, secret):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Paddle signature",
        )

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook body",
        ) from exc

    event_type = event.get("event_type") or event.get("type")
    event_id = event.get("event_id") or event.get("notification_id") or event.get("id")
    data = event.get("data") or {}

    logger.info("paddle_webhook_received event_type=%s event_id=%s", event_type, event_id)

    if event_type == "transaction.completed":
        return _handle_transaction_completed(database, data, event_id)

    if event_type in SUBSCRIPTION_EVENT_TYPES:
        user = _find_user_for_subscription(database, data)
        if user is None:
            logger.warning(
                "paddle_webhook_subscription_unknown_user event_type=%s subscription_id=%s",
                event_type,
                data.get("id"),
            )
            return {"received": True, "ignored": "unknown user"}

        previous_plan = user.plan
        _apply_subscription_state(user, data)
        database.commit()

        logger.info(
            "paddle_webhook_subscription_applied event_type=%s user_id=%s previous_plan=%s new_plan=%s status=%s",
            event_type,
            user.id,
            previous_plan,
            user.plan,
            user.subscription_status,
        )
        return {"received": True}

    if event_type == "transaction.payment_failed":
        logger.info(
            "paddle_webhook_payment_failed_logged event_id=%s transaction_id=%s",
            event_id,
            data.get("id"),
        )
        return {"received": True, "logged": True}

    return {"received": True}

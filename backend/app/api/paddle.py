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

    transaction_body: dict[str, Any] = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "custom_data": {
            "user_id": str(current_user.id),
            "duration_months": duration_months,
            "provider": "paddle",
            "product": "rentscout_pro_pass",
        },
    }

    if current_user.paddle_customer_id:
        transaction_body["customer_id"] = current_user.paddle_customer_id

    response = _paddle_request("POST", "/transactions", transaction_body)
    data = response.get("data") or {}
    transaction_id = data.get("id")

    if not transaction_id:
        logger.error("paddle_create_transaction_missing_id response=%s", response)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Paddle did not return a transaction id",
        )

    checkout = data.get("checkout") or {}
    checkout_url = checkout.get("url") if isinstance(checkout, dict) else None

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


def _add_months(base: datetime, months: int) -> datetime:
    year = base.year + (base.month - 1 + months) // 12
    month = (base.month - 1 + months) % 12 + 1
    day = min(
        base.day,
        [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
         31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
    )
    return base.replace(year=year, month=month, day=day)


def verify_paddle_signature(signature_header: str, raw_body: bytes, secret: str) -> bool:
    if not signature_header or not secret:
        return False

    parts = {}
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


def _apply_pro_pass(user: User, duration_months: int) -> None:
    now = datetime.utcnow()
    base = (
        user.pro_expires_at
        if user.pro_expires_at and user.pro_expires_at > now
        else now
    )
    user.pro_expires_at = _add_months(base, duration_months)
    user.plan = "pro"
    user.subscription_status = "active"
    user.billing_provider = "paddle"


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
        duration_raw = custom_data.get("duration_months") if isinstance(custom_data, dict) else None

        try:
            user_id = int(user_id_raw) if user_id_raw is not None else None
        except (TypeError, ValueError):
            user_id = None

        try:
            duration_months = int(duration_raw) if duration_raw is not None else None
        except (TypeError, ValueError):
            duration_months = None

        if user_id is None or duration_months is None or duration_months <= 0:
            logger.warning(
                "paddle_webhook_missing_custom_data transaction_id=%s custom_data=%s",
                transaction_id,
                custom_data,
            )
            return {"received": True, "ignored": "missing custom_data"}

        user = database.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.warning(
                "paddle_webhook_unknown_user transaction_id=%s user_id=%s",
                transaction_id,
                user_id,
            )
            return {"received": True, "ignored": "unknown user"}

        customer_id = data.get("customer_id")
        if customer_id:
            user.paddle_customer_id = str(customer_id)

        user.paddle_transaction_id = str(transaction_id)
        _apply_pro_pass(user, duration_months)

        database.add(
            PaddleEvent(
                event_id=str(event_id) if event_id else None,
                transaction_id=str(transaction_id),
                event_type=event_type,
                user_id=user.id,
                duration_months=duration_months,
            )
        )
        database.commit()
        return {"received": True}

    if event_type in {
        "transaction.payment_failed",
        "subscription.created",
        "subscription.updated",
        "subscription.canceled",
        "subscription.paused",
        "subscription.past_due",
    }:
        logger.info(
            "paddle_webhook_unhandled_event_logged event_type=%s event_id=%s",
            event_type,
            event_id,
        )
        return {"received": True, "logged": True}

    return {"received": True}

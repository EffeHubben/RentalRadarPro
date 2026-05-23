from datetime import datetime

from fastapi import HTTPException, status

from app.models.user import User


PRO_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def is_pro(user: User) -> bool:
    status_value = (user.subscription_status or "").lower()

    if user.plan == "pro" and status_value in PRO_SUBSCRIPTION_STATUSES:
        return True

    # Canceled subscriptions retain access until the paid-through date.
    if status_value == "canceled":
        period_end = getattr(user, "subscription_current_period_end", None)
        if period_end is not None and period_end > datetime.utcnow():
            return True

    # Legacy / Paddle-derived paid-through fallback.
    expires_at = getattr(user, "pro_expires_at", None)
    if expires_at is not None and expires_at > datetime.utcnow():
        return True

    return False


def require_pro(user: User) -> None:
    if not is_pro(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Pro subscription",
        )

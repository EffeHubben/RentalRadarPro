from fastapi import HTTPException, status

from app.models.user import User


def is_pro(user: User) -> bool:
    return user.plan == "pro" and user.subscription_status == "active"


def require_pro(user: User) -> None:
    if not is_pro(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Pro subscription",
        )

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import User


def is_admin(user: User) -> bool:
    return bool(user.is_admin)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint requires admin access",
        )

    return user

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    hash_refresh_token,
    normalize_email,
    verify_password,
)
from app.database.db import get_database_session
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    AuthUserResponse,
    LoginRequest,
    LogoutResponse,
    RefreshResponse,
    RegisterRequest,
)


router = APIRouter(prefix="/api/auth", tags=["Auth"])


def access_token_expires_in_seconds() -> int:
    return settings.auth_access_token_minutes * 60


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=token,
        max_age=settings.auth_refresh_token_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


def create_refresh_token_record(
    request: Request,
    database: Session,
    user: User,
) -> str:
    refresh_token = create_refresh_token()
    token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.utcnow() + timedelta(days=settings.auth_refresh_token_days),
    )
    database.add(token_record)
    return refresh_token


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    database: Session = Depends(get_database_session),
):
    email_normalized = normalize_email(payload.email)
    existing_user = database.query(User).filter(User.email_normalized == email_normalized).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email.strip(),
        email_normalized=email_normalized,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip() if payload.display_name else None,
        preferred_language=payload.preferred_language,
        last_login_at=datetime.utcnow(),
    )
    database.add(user)
    database.flush()

    refresh_token = create_refresh_token_record(request, database, user)
    database.commit()
    database.refresh(user)

    set_refresh_cookie(response, refresh_token)

    return AuthResponse(
        user=user,
        access_token=create_access_token(user),
        expires_in=access_token_expires_in_seconds(),
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    database: Session = Depends(get_database_session),
):
    email_normalized = normalize_email(payload.email)
    user = database.query(User).filter(User.email_normalized == email_normalized).first()

    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user.last_login_at = datetime.utcnow()
    refresh_token = create_refresh_token_record(request, database, user)
    database.commit()
    database.refresh(user)

    set_refresh_cookie(response, refresh_token)

    return AuthResponse(
        user=user,
        access_token=create_access_token(user),
        expires_in=access_token_expires_in_seconds(),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh_session(
    request: Request,
    database: Session = Depends(get_database_session),
):
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name)

    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    token_hash = hash_refresh_token(refresh_token)
    token_record = (
        database.query(RefreshToken)
        .join(User)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
            User.is_active.is_(True),
        )
        .first()
    )

    if not token_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_record.last_used_at = datetime.utcnow()
    database.commit()
    database.refresh(token_record.user)

    return RefreshResponse(
        access_token=create_access_token(token_record.user),
        expires_in=access_token_expires_in_seconds(),
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    database: Session = Depends(get_database_session),
):
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name)

    if refresh_token:
        token_record = database.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_refresh_token(refresh_token),
            RefreshToken.revoked_at.is_(None),
        ).first()

        if token_record:
            token_record.revoked_at = datetime.utcnow()
            database.commit()

    clear_refresh_cookie(response)
    return LogoutResponse(ok=True)


@router.get("/me", response_model=AuthUserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

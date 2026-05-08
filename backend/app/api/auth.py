import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_one_time_token,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    hash_refresh_token,
    hash_token,
    normalize_email,
    password_strength_error,
    verify_password,
)
from app.database.db import get_database_session
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    AuthUserResponse,
    ChangeEmailRequest,
    ChangePasswordRequest,
    LoginRequest,
    LogoutResponse,
    MessageResponse,
    RequestPasswordResetRequest,
    RefreshResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
)
from app.services.email import (
    EmailUserContext,
    send_email_verification_email,
    send_password_reset_email,
    send_welcome_email,
)


router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger("rentscout.auth")
PASSWORD_RESET_SUCCESS_MESSAGE = (
    "If an account exists for that email address, a password reset link will be sent shortly."
)
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def access_token_expires_in_seconds() -> int:
    return settings.auth_access_token_minutes * 60


def verify_turnstile_token(token: str, remote_ip: str | None) -> bool:
    payload = {
        "secret": settings.turnstile_secret_key,
        "response": token,
    }

    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        response = requests.post(
            TURNSTILE_VERIFY_URL,
            data=payload,
            timeout=8,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.exception("turnstile_request_failed")
        return False

    payload: dict[str, Any] = response.json()
    return bool(payload.get("success"))


def enforce_registration_bot_check(payload: RegisterRequest, request: Request) -> None:
    if not settings.turnstile_secret_key:
        if settings.turnstile_required:
            logger.error("turnstile_required_but_secret_missing")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Registration protection is temporarily unavailable",
            )
        logger.info("turnstile_skipped_missing_secret")
        return

    if not payload.captcha_token:
        if settings.turnstile_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete the verification challenge",
            )
        logger.info("turnstile_optional_token_missing")
        return

    if not verify_turnstile_token(payload.captcha_token, request.client.host if request.client else None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification failed. Please try again.",
        )


def set_refresh_cookie(response: Response, token: str) -> None:
    clear_legacy_refresh_cookie(response)
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=token,
        max_age=settings.auth_refresh_token_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure_enabled,
        samesite=settings.refresh_cookie_samesite,
        path=settings.auth_refresh_cookie_path,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure_enabled,
        samesite=settings.refresh_cookie_samesite,
        path=settings.auth_refresh_cookie_path,
    )
    clear_legacy_refresh_cookie(response)


def clear_legacy_refresh_cookie(response: Response) -> None:
    if settings.auth_refresh_cookie_path == "/":
        return

    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure_enabled,
        samesite=settings.refresh_cookie_samesite,
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


def rotate_current_session(
    request: Request,
    response: Response,
    database: Session,
    user: User,
) -> None:
    existing_refresh_token = request.cookies.get(settings.auth_refresh_cookie_name)

    if existing_refresh_token:
        database.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_refresh_token(existing_refresh_token),
            RefreshToken.revoked_at.is_(None),
        ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)

    refresh_token = create_refresh_token_record(request, database, user)
    set_refresh_cookie(response, refresh_token)


def issue_email_verification_token(user: User) -> tuple[str, str, datetime]:
    token = create_one_time_token()
    token_hash = hash_token(token)
    sent_at = datetime.utcnow()
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.email_verification_token_expiration_minutes
    )
    user.email_verification_token_hash = token_hash
    user.email_verification_sent_at = sent_at
    user.email_verification_expires_at = expires_at
    return token, f"email_verification:user:{user.id}:{sent_at.strftime('%Y%m%d%H%M%S%f')}", expires_at


def issue_password_reset_token(user: User) -> tuple[str, str, datetime]:
    token = create_one_time_token()
    token_hash = hash_token(token)
    sent_at = datetime.utcnow()
    expires_at = datetime.utcnow() + timedelta(
        minutes=settings.password_reset_token_expiration_minutes
    )
    user.password_reset_token_hash = token_hash
    user.password_reset_sent_at = sent_at
    user.password_reset_expires_at = expires_at
    return token, f"password_reset:user:{user.id}:{sent_at.strftime('%Y%m%d%H%M%S%f')}", expires_at


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_database_session),
):
    enforce_registration_bot_check(payload, request)

    verification_token: str | None = None
    verification_event_key: str | None = None
    email_normalized = normalize_email(payload.email)
    existing_user = database.query(User).filter(User.email_normalized == email_normalized).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    password_error = password_strength_error(payload.password)
    if password_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=password_error,
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

    if settings.email_verification_enabled:
        verification_token, verification_event_key, _ = issue_email_verification_token(user)

    refresh_token = create_refresh_token_record(request, database, user)
    database.commit()
    database.refresh(user)

    set_refresh_cookie(response, refresh_token)
    user_context = EmailUserContext.from_user(user)
    background_tasks.add_task(send_welcome_email, user_context)
    logger.info("welcome_email_queued user_id=%s", user.id)

    if settings.email_verification_enabled and verification_token and verification_event_key:
        background_tasks.add_task(
            send_email_verification_email,
            user_context,
            verification_token,
            verification_event_key,
        )
        logger.info("email_verification_email_queued user_id=%s", user.id)

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


@router.get("/verify-email", response_model=MessageResponse)
def verify_email(
    token: str,
    database: Session = Depends(get_database_session),
):
    token_hash = hash_token(token)
    user = database.query(User).filter(User.email_verification_token_hash == token_hash).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    if user.email_verification_expires_at and user.email_verification_expires_at < datetime.utcnow():
        user.email_verification_token_hash = None
        user.email_verification_expires_at = None
        database.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    database.commit()

    return MessageResponse(ok=True, message="Email address verified")


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: RequestPasswordResetRequest,
    background_tasks: BackgroundTasks,
    database: Session = Depends(get_database_session),
):
    if not settings.password_reset_enabled:
        logger.info("password_reset_request_skipped_disabled")
        return MessageResponse(ok=True, message=PASSWORD_RESET_SUCCESS_MESSAGE)

    email_normalized = normalize_email(payload.email)
    user = (
        database.query(User)
        .filter(User.email_normalized == email_normalized, User.is_active.is_(True))
        .first()
    )

    if not user:
        return MessageResponse(ok=True, message=PASSWORD_RESET_SUCCESS_MESSAGE)

    reset_token, reset_event_key, _ = issue_password_reset_token(user)
    database.commit()

    background_tasks.add_task(
        send_password_reset_email,
        EmailUserContext.from_user(user),
        reset_token,
        reset_event_key,
    )
    logger.info("password_reset_email_queued user_id=%s", user.id)
    return MessageResponse(ok=True, message=PASSWORD_RESET_SUCCESS_MESSAGE)


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: ResetPasswordRequest,
    database: Session = Depends(get_database_session),
):
    if not settings.password_reset_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Password reset is not available",
        )

    password_error = password_strength_error(payload.password)
    if password_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=password_error,
        )

    token_hash = hash_token(payload.token)
    user = database.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user or not user.password_reset_expires_at or user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    user.password_hash = hash_password(payload.password)
    user.password_reset_token_hash = None
    user.password_reset_sent_at = None
    user.password_reset_expires_at = None

    database.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)

    database.commit()
    return MessageResponse(ok=True, message="Password reset completed")


@router.patch("/profile", response_model=MessageResponse)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    current_user.display_name = payload.display_name.strip() if payload.display_name else None
    current_user.preferred_language = payload.preferred_language
    database.commit()

    return MessageResponse(ok=True, message="Profile updated")


@router.post("/change-email", response_model=MessageResponse)
def change_email(
    payload: ChangeEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    new_email_normalized = normalize_email(payload.new_email)

    if new_email_normalized == current_user.email_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email address must be different from your current email",
        )

    existing_user = (
        database.query(User)
        .filter(User.email_normalized == new_email_normalized, User.id != current_user.id)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    current_user.email = payload.new_email.strip()
    current_user.email_normalized = new_email_normalized
    current_user.email_verified = False

    verification_token: str | None = None
    verification_event_key: str | None = None

    if settings.email_verification_enabled:
        verification_token, verification_event_key, _ = issue_email_verification_token(current_user)
    else:
        current_user.email_verification_token_hash = None
        current_user.email_verification_sent_at = None
        current_user.email_verification_expires_at = None

    database.commit()
    database.refresh(current_user)

    if settings.email_verification_enabled and verification_token and verification_event_key:
        background_tasks.add_task(
            send_email_verification_email,
            EmailUserContext.from_user(current_user),
            verification_token,
            verification_event_key,
        )
        logger.info("email_verification_email_queued user_id=%s reason=email_change", current_user.id)
        return MessageResponse(
            ok=True,
            message="Email address updated. Check your inbox to verify the new address",
        )

    return MessageResponse(ok=True, message="Email address updated")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    database: Session = Depends(get_database_session),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    password_error = password_strength_error(payload.new_password)
    if password_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=password_error,
        )

    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.password_reset_token_hash = None
    current_user.password_reset_sent_at = None
    current_user.password_reset_expires_at = None

    database.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)

    rotate_current_session(request, response, database, current_user)
    database.commit()

    return MessageResponse(ok=True, message="Password updated")


@router.get("/me", response_model=AuthUserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    preferred_language: str | None = Field(default=None, pattern="^(nl|en)$")
    captcha_token: str | None = Field(default=None, max_length=2048)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthUserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    preferred_language: str | None
    email_verified: bool
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login_at: datetime | None
    plan: str
    subscription_status: str
    subscription_current_period_end: datetime | None
    subscription_cancel_at_period_end: bool
    pro_expires_at: datetime | None = None
    billing_provider: str | None = None
    paddle_subscription_id: str | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: AuthUserResponse
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LogoutResponse(BaseModel):
    ok: bool


class MessageResponse(BaseModel):
    ok: bool
    message: str


class RequestPasswordResetRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    password: str = Field(min_length=1, max_length=128)


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    preferred_language: str | None = Field(default=None, pattern="^(nl|en)$")


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)

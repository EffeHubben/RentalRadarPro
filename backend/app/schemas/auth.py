from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    preferred_language: str | None = Field(default=None, pattern="^(nl|en)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthUserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    preferred_language: str | None
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    plan: str
    subscription_status: str
    subscription_current_period_end: datetime | None

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

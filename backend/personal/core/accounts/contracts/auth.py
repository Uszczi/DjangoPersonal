"""Auth contracts: request payloads and response shapes."""

from pydantic import Field, model_validator

from personal.core.shared.base import BaseModel


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1)
    password_confirm: str = Field(min_length=1)

    @model_validator(mode='after')
    def passwords_match(self) -> 'RegisterRequest':
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match.')
        return self


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh: str


class UserResponse(BaseModel):
    id: int
    username: str


class AuthResponse(BaseModel):
    access: str
    refresh: str


class LoginResponse(BaseModel):
    access: str
    refresh: str


class RefreshResponse(BaseModel):
    access: str
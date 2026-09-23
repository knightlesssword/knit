"""Pydantic v2 schemas: UI/API boundary validation. DB constraints are the backstop."""
from __future__ import annotations

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not _EMAIL_RE.match(email):
        raise ValueError("enter a valid email address")
    return email


def _require_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("name is required")
    return value


def _optional_name(value: str | None) -> str | None:
    if value is None:
        return None
    return _require_name(value)


def _optional_email(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return _normalize_email(value)


class RegisterIn(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    email: Annotated[str, Field(min_length=3, max_length=320)]
    password: Annotated[str, Field(min_length=8, max_length=256)]

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name is required")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)


class LoginIn(BaseModel):
    identifier: Annotated[str, Field(min_length=1, max_length=320)]
    password: Annotated[str, Field(min_length=1, max_length=256)]

    @field_validator("identifier")
    @classmethod
    def _identifier(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: str
    updated_at: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


class ClientCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    company: Annotated[str | None, Field(default=None, max_length=200)]
    email: Annotated[str | None, Field(default=None, max_length=320)]
    phone: Annotated[str | None, Field(default=None, max_length=60)]
    notes: Annotated[str | None, Field(default=None, max_length=5000)]

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return _require_name(v)

    @field_validator("company", "phone", "notes")
    @classmethod
    def clean_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str | None) -> str | None:
        return _optional_email(v)


class ClientUpdate(BaseModel):
    name: Annotated[str | None, Field(default=None, max_length=120)]
    company: Annotated[str | None, Field(default=None, max_length=200)]
    email: Annotated[str | None, Field(default=None, max_length=320)]
    phone: Annotated[str | None, Field(default=None, max_length=60)]
    notes: Annotated[str | None, Field(default=None, max_length=5000)]

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        return _optional_name(v)

    @field_validator("company", "phone", "notes")
    @classmethod
    def clean_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str | None) -> str | None:
        return _optional_email(v)


class ClientProjectOut(BaseModel):
    id: int
    name: str
    status: str
    archived_at: str | None


class ClientOut(BaseModel):
    id: int
    name: str
    company: str | None
    email: str | None
    phone: str | None
    notes: str | None
    created_at: str
    updated_at: str
    projects: list[ClientProjectOut] = Field(default_factory=list)


ProjectType = Literal["fixed_price", "hourly", "retainer"]
ProjectStatus = Literal["active", "on_hold", "completed"]
Currency = Literal["USD", "GBP", "INR"]

Money = Annotated[int | None, Field(default=None, ge=0)]


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class ProjectCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=120)]
    client_id: Annotated[int, Field(gt=0)]
    project_type: ProjectType
    status: ProjectStatus = "active"
    currency: Currency
    description: Annotated[str | None, Field(default=None, max_length=5000)]
    notes: Annotated[str | None, Field(default=None, max_length=5000)]
    budget: Money = None
    hourly_rate: Money = None
    fixed_price: Money = None
    recurring_amount: Money = None
    recurring_billing_period: Annotated[str | None, Field(default=None, max_length=40)]
    start_date: date | None = None
    due_date: date | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return _require_name(v)

    @field_validator("description", "notes", "recurring_billing_period")
    @classmethod
    def clean_text(cls, v: str | None) -> str | None:
        return _optional_text(v)


class ProjectUpdate(BaseModel):
    name: Annotated[str | None, Field(default=None, max_length=120)]
    client_id: Annotated[int | None, Field(default=None, gt=0)]
    project_type: ProjectType | None = None
    status: ProjectStatus | None = None
    currency: Currency | None = None
    description: Annotated[str | None, Field(default=None, max_length=5000)]
    notes: Annotated[str | None, Field(default=None, max_length=5000)]
    budget: Money = None
    hourly_rate: Money = None
    fixed_price: Money = None
    recurring_amount: Money = None
    recurring_billing_period: Annotated[str | None, Field(default=None, max_length=40)]
    start_date: date | None = None
    due_date: date | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        return _optional_name(v)

    @field_validator("description", "notes", "recurring_billing_period")
    @classmethod
    def clean_text(cls, v: str | None) -> str | None:
        return _optional_text(v)


class ProjectOut(BaseModel):
    id: int
    user_id: int
    client_id: int
    client_name: str
    name: str
    description: str | None
    notes: str | None
    project_type: str
    status: str
    currency: str
    budget: int | None
    hourly_rate: int | None
    fixed_price: int | None
    recurring_amount: int | None
    recurring_billing_period: str | None
    start_date: date | None
    due_date: date | None
    archived_at: str | None
    created_at: str
    updated_at: str

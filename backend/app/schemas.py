"""Pydantic v2 schemas: UI/API boundary validation. DB constraints are the backstop."""
from __future__ import annotations

import re
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not _EMAIL_RE.match(email):
        raise ValueError("enter a valid email address")
    return email


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

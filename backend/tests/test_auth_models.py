"""Tests for the auth models.

These need no database: the only logic on the models is the email validator,
and SQLAlchemy runs it on assignment, before anything is persisted.
"""

import pytest

from app.modules.auth.models import AuthProvider, User, UserRole


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("Ali@Example.com", "ali@example.com"),
        ("  ali@example.com  ", "ali@example.com"),
        ("ALI@EXAMPLE.COM", "ali@example.com"),
        ("ali@example.com", "ali@example.com"),
    ],
)
def test_email_is_normalised_on_assignment(given: str, expected: str) -> None:
    """Email is lowercased and trimmed before it can reach the database.

    Without this the unique constraint does not actually hold - `Ali@x.com` and
    `ali@x.com` would become two accounts and password reset would stop making
    sense. The rule lives on the model so no code path can bypass it.
    """
    user = User(email=given, full_name="Ali")

    assert user.email == expected


def test_a_null_email_is_left_alone() -> None:
    """The validator must not crash on None - the column is set in two steps
    in some flows, and a TypeError here would be a confusing failure."""
    user = User(email=None, full_name="Ali")

    assert user.email is None


def test_role_values_match_the_spec() -> None:
    """Module 1.3 names exactly these three roles."""
    assert {r.value for r in UserRole} == {"candidate", "company", "both"}


def test_linkedin_is_a_known_provider() -> None:
    """Module 1.1. Adding Google or GitHub later means adding a member here,
    not a migration - that is the point of the separate identities table."""
    assert AuthProvider.LINKEDIN.value == "linkedin"

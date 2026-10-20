"""Tests for GET and PATCH /api/v1/profile/me - Modules 1.4 and 1.5."""

from httpx import AsyncClient

from tests.fakes import MemoryStorage

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROFILE_URL = "/api/v1/profile/me"
DOCUMENTS_URL = "/api/v1/verification/documents"

_PASSWORD = "secret123"
_PDF = b"%PDF-1.7\n" + b"employment-letter"


async def _sign_in(
    client: AsyncClient, email: str = "profile-test@example.com", role: str = "candidate"
) -> dict:
    """Register a user, log in, and return the Authorization header."""
    await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": _PASSWORD,
            "full_name": "Profile Test",
            "role": role,
        },
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_profile_requires_a_token(client: AsyncClient, clean_users_table: None) -> None:
    assert (await client.get(PROFILE_URL)).status_code == 401
    assert (await client.patch(PROFILE_URL, json={"degree": "BSc"})).status_code == 401


async def test_first_read_returns_an_empty_profile_at_step_one(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.get(PROFILE_URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "headline": None,
        "city": None,
        "phone": None,
        "linkedin_url": None,
        "bio": None,
        "photo_url": None,
        "university": None,
        "degree": None,
        "graduation_year": None,
        "employer_name": None,
        "cv": None,
        "skills": [],
        "primary_role": None,
        "desired_roles": [],
        "work_mode": None,
        "preferred_locations": [],
        "salary_min": None,
        "salary_max": None,
        "available_from": None,
        "open_to_referrers": True,
        "job_title": None,
        "team": None,
        "referral_teams": [],
        "monthly_referral_limit": 5,
        "accept_alumni_requests": True,
        "accept_any_verified_requests": False,
        "onboarding_step": 1,
        "onboarding_completed": False,
    }


async def test_patch_saves_fields_and_get_returns_them(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    patch = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={
            "university": "LUMS",
            "degree": "BSc Computer Science",
            "graduation_year": 2026,
            "employer_name": "Garner",
        },
    )
    stored = await client.get(PROFILE_URL, headers=headers)

    assert patch.status_code == 200
    assert stored.json() == patch.json()
    assert stored.json()["university"] == "LUMS"
    assert stored.json()["graduation_year"] == 2026


async def test_patch_changes_only_the_fields_sent(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"university": "LUMS", "degree": "BSc"})

    response = await client.patch(PROFILE_URL, headers=headers, json={"degree": "MSc"})

    assert response.json()["university"] == "LUMS"
    assert response.json()["degree"] == "MSc"


async def test_patch_null_clears_a_field(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"employer_name": "Garner"})

    response = await client.patch(PROFILE_URL, headers=headers, json={"employer_name": None})

    assert response.json()["employer_name"] is None


async def test_text_fields_are_trimmed(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"university": "  LUMS  "})

    assert response.json()["university"] == "LUMS"


async def test_implausible_graduation_year_is_rejected(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    too_old = await client.patch(PROFILE_URL, headers=headers, json={"graduation_year": 1900})
    too_far = await client.patch(PROFILE_URL, headers=headers, json={"graduation_year": 2999})

    assert too_old.status_code == 422
    assert too_far.status_code == 422


async def test_unknown_field_is_rejected(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"universty": "LUMS"})

    assert response.status_code == 422


async def test_step_can_advance_by_one(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 2})

    assert response.status_code == 200
    assert response.json()["onboarding_step"] == 2


async def test_step_cannot_skip_ahead(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 4})

    assert response.status_code == 422
    stored = await client.get(PROFILE_URL, headers=headers)
    assert stored.json()["onboarding_step"] == 1


async def test_step_can_go_back(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 2})
    await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 3})

    response = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 1})

    assert response.status_code == 200
    assert response.json()["onboarding_step"] == 1


async def test_step_is_limited_to_the_seven_steps(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    too_high = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 8})
    zero = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 0})

    assert too_high.status_code == 422
    assert zero.status_code == 422


async def test_step_is_remembered_across_sessions(
    client: AsyncClient, clean_users_table: None
) -> None:
    """The resume case: save & exit, log in again later, land on the same step."""
    first = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=first, json={"onboarding_step": 2})

    login = await client.post(
        LOGIN_URL, json={"email": "profile-test@example.com", "password": _PASSWORD}
    )
    second = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.get(PROFILE_URL, headers=second)

    assert response.json()["onboarding_step"] == 2


async def test_profile_step_fields_are_saved(client: AsyncClient, clean_users_table: None) -> None:
    """The Profile step of onboarding (Figma 65:198)."""
    headers = await _sign_in(client)

    response = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={
            "headline": "Final-year CS student · Backend & distributed systems",
            "city": "Lahore, Pakistan",
            "phone": "+92 300 1234567",
            "linkedin_url": "linkedin.com/in/abdulrafay",
            "bio": "I build reliable backend systems in Go and Python.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["headline"] == "Final-year CS student · Backend & distributed systems"
    assert body["phone"] == "+923001234567"
    assert body["linkedin_url"] == "https://www.linkedin.com/in/abdulrafay"


async def test_a_local_phone_number_gets_the_pakistan_code(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"phone": "0300-1234567"})

    assert response.json()["phone"] == "+923001234567"


async def test_bad_phone_and_linkedin_values_are_rejected(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    phone = await client.patch(PROFILE_URL, headers=headers, json={"phone": "12345"})
    linkedin = await client.patch(
        PROFILE_URL, headers=headers, json={"linkedin_url": "https://example.com/abdul"}
    )

    assert phone.status_code == 422
    assert linkedin.status_code == 422


async def test_bio_is_limited_to_280_characters(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.patch(PROFILE_URL, headers=headers, json={"bio": "x" * 281})

    assert response.status_code == 422


async def test_skills_are_trimmed_and_deduplicated(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={"skills": [" React ", "react", "Python", ""], "primary_role": "backend"},
    )

    assert response.json()["skills"] == ["React", "Python"]
    assert response.json()["primary_role"] == "backend"


async def test_preferences_are_saved(client: AsyncClient, clean_users_table: None) -> None:
    """The Preferences step (Figma 65:545)."""
    headers = await _sign_in(client)

    response = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={
            "desired_roles": ["backend_engineer", "full_stack_engineer", "backend_engineer"],
            "work_mode": "hybrid",
            "preferred_locations": ["Lahore", "Karachi", "Remote"],
            "salary_min": 250000,
            "salary_max": 350000,
            "available_from": "2026-07-15",
            "open_to_referrers": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["desired_roles"] == ["backend_engineer", "full_stack_engineer"]
    assert body["work_mode"] == "hybrid"
    assert body["preferred_locations"] == ["Lahore", "Karachi", "Remote"]
    assert body["available_from"] == "2026-07-01"  # a month, not a day
    assert body["open_to_referrers"] is False


async def test_unknown_choice_values_are_rejected(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    role = await client.patch(PROFILE_URL, headers=headers, json={"desired_roles": ["ceo"]})
    mode = await client.patch(PROFILE_URL, headers=headers, json={"work_mode": "moon"})

    assert role.status_code == 422
    assert mode.status_code == 422


async def test_salary_minimum_cannot_exceed_maximum(
    client: AsyncClient, clean_users_table: None
) -> None:
    """Checked against the saved value too, not only within one request."""
    headers = await _sign_in(client)
    await client.patch(PROFILE_URL, headers=headers, json={"salary_max": 200000})

    response = await client.patch(PROFILE_URL, headers=headers, json={"salary_min": 300000})

    assert response.status_code == 422


async def test_onboarding_can_only_be_finished_from_the_last_step(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)

    response = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert response.status_code == 422
    stored = await client.get(PROFILE_URL, headers=headers)
    assert stored.json()["onboarding_completed"] is False


async def test_finishing_onboarding_on_the_last_step(
    client: AsyncClient, clean_users_table: None
) -> None:
    """Being on step 7 is not the same as having finished it."""
    headers = await _sign_in(client)
    for step in range(2, 8):
        await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": step})
    on_last_step = await client.get(PROFILE_URL, headers=headers)

    finished = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)
    again = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert on_last_step.json()["onboarding_completed"] is False
    assert finished.status_code == 200
    assert finished.json()["onboarding_completed"] is True
    assert again.status_code == 200


async def test_referring_settings_are_saved(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_in(client, role="referrer")

    response = await client.patch(
        PROFILE_URL,
        headers=headers,
        json={
            "employer_name": "Garner",
            "job_title": "  Senior Software Engineer ",
            "team": "Payments Platform",
            "referral_teams": ["backend", "full_stack", "backend"],
            "monthly_referral_limit": None,
            "accept_alumni_requests": False,
            "accept_any_verified_requests": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["job_title"] == "Senior Software Engineer"
    assert body["team"] == "Payments Platform"
    assert body["referral_teams"] == ["backend", "full_stack"]
    assert body["monthly_referral_limit"] is None
    assert body["accept_alumni_requests"] is False
    assert body["accept_any_verified_requests"] is True


async def test_unknown_referring_choices_are_rejected(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client, role="referrer")

    team = await client.patch(PROFILE_URL, headers=headers, json={"referral_teams": ["sales"]})
    limit = await client.patch(PROFILE_URL, headers=headers, json={"monthly_referral_limit": 7})

    assert team.status_code == 422
    assert limit.status_code == 422


async def _referrer_on_last_step(client: AsyncClient) -> dict:
    """A referrer-only user on step 3 who has said where they work."""
    headers = await _sign_in(client, role="referrer")
    await client.patch(
        PROFILE_URL,
        headers=headers,
        json={"employer_name": "Garner", "job_title": "Engineer", "onboarding_step": 2},
    )
    await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 3})
    return headers


async def _upload_employment_letter(client: AsyncClient, headers: dict) -> None:
    await client.post(
        DOCUMENTS_URL,
        headers=headers,
        data={"kind": "employer"},
        files={"file": ("letter.pdf", _PDF, "application/pdf")},
    )


async def test_a_referrer_only_wizard_has_three_steps(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _referrer_on_last_step(client)
    await _upload_employment_letter(client, headers)

    too_far = await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": 4})
    finished = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert too_far.status_code == 422
    assert finished.status_code == 200
    assert finished.json()["onboarding_completed"] is True


async def test_a_referrer_cannot_finish_without_employer_proof(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _referrer_on_last_step(client)

    response = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert response.status_code == 422
    assert "work email" in response.json()["detail"]


async def test_a_referrer_cannot_finish_without_a_job_title(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _referrer_on_last_step(client)
    await _upload_employment_letter(client, headers)
    await client.patch(PROFILE_URL, headers=headers, json={"job_title": None})

    response = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert response.status_code == 422


async def test_a_candidate_cannot_finish_on_step_three(
    client: AsyncClient, clean_users_table: None
) -> None:
    headers = await _sign_in(client)
    for step in (2, 3):
        await client.patch(PROFILE_URL, headers=headers, json={"onboarding_step": step})

    response = await client.post(f"{PROFILE_URL}/onboarding/complete", headers=headers)

    assert response.status_code == 422


async def test_users_only_see_their_own_profile(
    client: AsyncClient, clean_users_table: None
) -> None:
    alice = await _sign_in(client, "alice@example.com")
    bob = await _sign_in(client, "bob@example.com")
    await client.patch(PROFILE_URL, headers=alice, json={"university": "LUMS"})

    response = await client.get(PROFILE_URL, headers=bob)

    assert response.json()["university"] is None

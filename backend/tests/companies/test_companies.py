"""Tests for /api/v1/companies - create or join by verified domain (ADR 0020)."""

import uuid

from httpx import AsyncClient

from app.core.database import SessionLocal
from app.modules.companies.models import CompanyMember
from tests.fakes import MemoryStorage, RecordingSender

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
SEND_URL = "/api/v1/verification/email/send"
CONFIRM_URL = "/api/v1/verification/email/confirm"
COMPANY_URL = "/api/v1/companies/me"
LOGO_URL = "/api/v1/companies/me/logo"

_PASSWORD = "secret123"
_PNG = b"\x89PNG\r\n\x1a\n" + b"logo"
_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'

GARNER = {
    "name": "Garner",
    "website": "https://www.Garner.com/careers",
    "size": "1000+",
    "industry": "fintech",
    "headquarters": "Lahore, Pakistan",
}


async def _sign_up(client: AsyncClient, email: str, role: str = "recruiter") -> dict:
    await client.post(
        REGISTER_URL,
        json={"email": email, "password": _PASSWORD, "full_name": "Ayesha", "role": role},
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _verify_work_email(
    client: AsyncClient, headers: dict, sender: RecordingSender, email: str
) -> None:
    body = {"email": email, "kind": "employer"}
    await client.post(SEND_URL, headers=headers, json=body)
    await client.post(CONFIRM_URL, headers=headers, json={**body, "code": sender.last_code()})


async def _verified_recruiter(
    client: AsyncClient, sender: RecordingSender, email: str = "ayesha@garner.com"
) -> dict:
    headers = await _sign_up(client, f"{uuid.uuid4().hex[:8]}@example.com")
    await _verify_work_email(client, headers, sender, email)
    return headers


async def test_it_requires_a_token(client: AsyncClient) -> None:
    assert (await client.get(COMPANY_URL)).status_code == 401
    assert (await client.post(COMPANY_URL, json=GARNER)).status_code == 401


async def test_no_company_yet_is_a_404(client: AsyncClient, clean_users_table: None) -> None:
    headers = await _sign_up(client, "ayesha@example.com")

    response = await client.get(COMPANY_URL, headers=headers)

    assert response.status_code == 404


async def test_a_verified_recruiter_creates_the_company_as_owner(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender)

    created = await client.post(COMPANY_URL, headers=headers, json=GARNER)
    mine = await client.get(COMPANY_URL, headers=headers)

    assert created.status_code == 201
    body = created.json()
    assert body["domain"] == "garner.com"
    assert body["my_role"] == "owner"
    assert body["size"] == "1000+"
    assert body["verified_at"] is not None
    assert body["logo_url"] is None
    assert mine.json()["id"] == body["id"]


async def test_a_work_email_on_a_subdomain_counts(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender, "ayesha@eng.garner.com")

    response = await client.post(COMPANY_URL, headers=headers, json=GARNER)

    assert response.status_code == 201


async def test_without_a_verified_email_on_the_domain_it_is_refused(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender, "ayesha@arbisoft.com")

    response = await client.post(COMPANY_URL, headers=headers, json=GARNER)

    assert response.status_code == 422
    assert "@garner.com" in response.json()["detail"]


async def test_a_second_recruiter_on_the_domain_joins_the_same_company(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await _verified_recruiter(client, sender, "ayesha@garner.com")
    created = (await client.post(COMPANY_URL, headers=owner, json=GARNER)).json()
    colleague = await _verified_recruiter(client, sender, "bilal@garner.com")

    joined = await client.post(
        COMPANY_URL, headers=colleague, json={**GARNER, "name": "Garner Ltd"}
    )

    assert joined.status_code == 200
    assert joined.json()["id"] == created["id"]
    assert joined.json()["my_role"] == "recruiter"
    # Joining never renames the company.
    assert joined.json()["name"] == "Garner"


async def test_belonging_to_a_company_already_is_a_409(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)

    again = await client.post(COMPANY_URL, headers=headers, json=GARNER)

    assert again.status_code == 409


async def test_only_recruiters_set_up_a_company(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _sign_up(client, "candidate@example.com", role="candidate")
    await _verify_work_email(client, headers, sender, "sara@garner.com")

    response = await client.post(COMPANY_URL, headers=headers, json=GARNER)

    assert response.status_code == 403


async def test_bad_fields_are_rejected(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender)

    for bad in (
        {**GARNER, "website": "not a website"},
        {**GARNER, "size": "huge"},
        {**GARNER, "industry": "crypto"},
        {**GARNER, "name": "   "},
        {**GARNER, "domain": "evil.com"},
    ):
        response = await client.post(COMPANY_URL, headers=headers, json=bad)
        assert response.status_code == 422, bad


async def test_the_owner_updates_details_but_never_the_domain(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    headers = await _verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)

    updated = await client.patch(
        COMPANY_URL,
        headers=headers,
        json={"headquarters": "Karachi, Pakistan", "employees_can_refer": False},
    )
    domain_change = await client.patch(COMPANY_URL, headers=headers, json={"domain": "evil.com"})

    assert updated.status_code == 200
    assert updated.json()["headquarters"] == "Karachi, Pakistan"
    assert updated.json()["employees_can_refer"] is False
    assert updated.json()["domain"] == "garner.com"
    assert domain_change.status_code == 422


async def test_an_interviewer_cannot_change_the_company(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await _verified_recruiter(client, sender)
    company_id = (await client.post(COMPANY_URL, headers=owner, json=GARNER)).json()["id"]
    interviewer = await _sign_up(client, "mehwish@example.com", role="candidate")
    me = await client.get("/api/v1/auth/me", headers=interviewer)
    async with SessionLocal() as session:
        session.add(
            CompanyMember(
                company_id=uuid.UUID(company_id),
                user_id=uuid.UUID(me.json()["id"]),
                role="interviewer",
            )
        )
        await session.commit()

    response = await client.patch(COMPANY_URL, headers=interviewer, json={"name": "Hacked"})

    assert response.status_code == 403


async def test_a_png_logo_is_stored_and_served_publicly(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender, storage: MemoryStorage
) -> None:
    headers = await _verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)

    uploaded = await client.put(
        LOGO_URL, headers=headers, files={"file": ("logo.png", _PNG, "image/png")}
    )
    logo_url = uploaded.json()["logo_url"]
    served = await client.get(logo_url)

    assert uploaded.status_code == 200
    assert served.status_code == 200
    assert served.content == _PNG
    assert served.headers["content-type"] == "image/png"


async def test_an_svg_logo_is_refused(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender, storage: MemoryStorage
) -> None:
    headers = await _verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)

    response = await client.put(
        LOGO_URL, headers=headers, files={"file": ("logo.svg", _SVG, "image/svg+xml")}
    )

    assert response.status_code == 422
    assert storage.files == {}


async def test_removing_the_logo_deletes_the_file(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender, storage: MemoryStorage
) -> None:
    headers = await _verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)
    await client.put(LOGO_URL, headers=headers, files={"file": ("logo.png", _PNG, "image/png")})

    removed = await client.delete(LOGO_URL, headers=headers)

    assert removed.json()["logo_url"] is None
    assert storage.files == {}

"""Sign-up and verification steps shared by the companies tests."""

import uuid

from httpx import AsyncClient

from tests.fakes import RecordingSender

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
SEND_URL = "/api/v1/verification/email/send"
CONFIRM_URL = "/api/v1/verification/email/confirm"
COMPANY_URL = "/api/v1/companies/me"

PASSWORD = "secret123"

GARNER = {
    "name": "Garner",
    "website": "https://www.Garner.com/careers",
    "size": "1000+",
    "industry": "fintech",
    "headquarters": "Lahore, Pakistan",
}


async def sign_up(client: AsyncClient, email: str, role: str = "recruiter") -> dict:
    """Register and log in; return the auth header."""
    await client.post(
        REGISTER_URL,
        json={"email": email, "password": PASSWORD, "full_name": "Ayesha", "role": role},
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def verify_work_email(
    client: AsyncClient, headers: dict, sender: RecordingSender, email: str
) -> None:
    body = {"email": email, "kind": "employer"}
    await client.post(SEND_URL, headers=headers, json=body)
    await client.post(CONFIRM_URL, headers=headers, json={**body, "code": sender.last_code()})


async def verified_recruiter(
    client: AsyncClient, sender: RecordingSender, email: str = "ayesha@garner.com"
) -> dict:
    """A recruiter with a verified work email at `email`."""
    headers = await sign_up(client, f"{uuid.uuid4().hex[:8]}@example.com")
    await verify_work_email(client, headers, sender, email)
    return headers


async def garner_owner(client: AsyncClient, sender: RecordingSender) -> dict:
    """A recruiter who owns Garner."""
    headers = await verified_recruiter(client, sender)
    await client.post(COMPANY_URL, headers=headers, json=GARNER)
    return headers

"""Sign-up, verification and team steps shared by the companies, jobs and profiles tests."""

import re
import uuid

from httpx import AsyncClient

from tests.fakes import RecordingSender

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
SEND_URL = "/api/v1/verification/email/send"
CONFIRM_URL = "/api/v1/verification/email/confirm"
COMPANY_URL = "/api/v1/companies/me"
INVITES_URL = "/api/v1/companies/me/invites"
ACCEPT_URL = "/api/v1/companies/invites/accept"

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


async def join_garner(
    client: AsyncClient, owner: dict, sender: RecordingSender, email: str, role: str
) -> dict:
    """A recruiter-only user invited to Garner as `role` who has accepted."""
    await client.post(INVITES_URL, headers=owner, json={"email": email, "role": role})
    token = re.search(r"register\?invite=(\S+)", sender.sent[-1]["body"]).group(1)
    headers = await sign_up(client, email)
    await client.post(ACCEPT_URL, headers=headers, json={"token": token})
    return headers

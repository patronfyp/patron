"""Tests for company invites (#104): send, list, revoke, preview and accept."""

import re
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import update

from app.core.database import SessionLocal
from app.modules.companies.models import CompanyInvite
from tests.companies.helpers import COMPANY_URL, garner_owner, sign_up
from tests.fakes import RecordingSender

INVITES_URL = "/api/v1/companies/me/invites"
PREVIEW_URL = "/api/v1/companies/invites/preview"
ACCEPT_URL = "/api/v1/companies/invites/accept"
ME_URL = "/api/v1/auth/me"

BILAL = {"email": "Bilal.Khan@garner.com", "role": "hiring_manager"}


def _token(sender: RecordingSender) -> str:
    return re.search(r"register\?invite=(\S+)", sender.sent[-1]["body"]).group(1)


async def _invite(client: AsyncClient, owner: dict, sender: RecordingSender) -> str:
    """Invite Bilal; return the token from the email."""
    await client.post(INVITES_URL, headers=owner, json=BILAL)
    return _token(sender)


async def _backdate_sent(minutes: int) -> None:
    async with SessionLocal() as session:
        await session.execute(
            update(CompanyInvite).values(sent_at=datetime.now(UTC) - timedelta(minutes=minutes))
        )
        await session.commit()


async def test_inviting_emails_a_link_and_lists_it_as_pending(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    sent = await client.post(INVITES_URL, headers=owner, json=BILAL)
    listed = await client.get(INVITES_URL, headers=owner)

    assert sent.status_code == 201
    assert sent.json()["email"] == "bilal.khan@garner.com"
    assert sent.json()["status"] == "pending"
    assert "token" not in sent.json()
    assert sender.sent[-1]["to"] == "bilal.khan@garner.com"
    assert "Garner" in sender.sent[-1]["subject"]
    assert [invite["email"] for invite in listed.json()] == ["bilal.khan@garner.com"]


async def test_only_the_company_domain_can_be_invited(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)

    outsider = await client.post(
        INVITES_URL, headers=owner, json={"email": "x@gmail.com", "role": "interviewer"}
    )
    owner_role = await client.post(
        INVITES_URL, headers=owner, json={"email": "x@garner.com", "role": "owner"}
    )

    assert outsider.status_code == 422
    assert owner_role.status_code == 422


async def test_resending_replaces_the_link_but_not_within_a_minute(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    first = await _invite(client, owner, sender)

    too_soon = await client.post(INVITES_URL, headers=owner, json=BILAL)
    await _backdate_sent(minutes=2)
    again = await client.post(INVITES_URL, headers=owner, json=BILAL)
    second = _token(sender)
    old_link = await client.post(PREVIEW_URL, json={"token": first})

    assert too_soon.status_code == 429
    assert again.status_code == 201
    assert second != first
    assert old_link.status_code == 404
    assert len((await client.get(INVITES_URL, headers=owner)).json()) == 1


async def test_a_failed_email_leaves_no_invite(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    sender.fail_next = True

    response = await client.post(INVITES_URL, headers=owner, json=BILAL)

    assert response.status_code == 503
    assert (await client.get(INVITES_URL, headers=owner)).json() == []


async def test_the_link_previews_who_is_inviting(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)

    preview = await client.post(PREVIEW_URL, json={"token": token})
    bad = await client.post(PREVIEW_URL, json={"token": "not-a-real-token"})

    assert preview.json() == {
        "company_name": "Garner",
        "company_domain": "garner.com",
        "email": "bilal.khan@garner.com",
        "role": "hiring_manager",
    }
    assert bad.status_code == 404


async def test_signing_up_and_accepting_joins_with_the_invited_role(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    bilal = await sign_up(client, "bilal.khan@garner.com", role="candidate")

    accepted = await client.post(ACCEPT_URL, headers=bilal, json={"token": token})
    me = (await client.get(ME_URL, headers=bilal)).json()
    company = (await client.get(COMPANY_URL, headers=bilal)).json()
    invites = (await client.get(INVITES_URL, headers=owner)).json()

    assert accepted.status_code == 200
    assert company["name"] == "Garner"
    assert company["my_role"] == "hiring_manager"
    assert "recruiter" in me["roles"]
    assert me["is_email_verified"] is True
    assert invites[0]["status"] == "accepted"


async def test_a_link_works_only_once(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    bilal = await sign_up(client, "bilal.khan@garner.com")
    await client.post(ACCEPT_URL, headers=bilal, json={"token": token})

    again = await client.post(ACCEPT_URL, headers=bilal, json={"token": token})

    assert again.status_code == 404


async def test_the_invite_is_for_its_own_email_only(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    someone_else = await sign_up(client, "mehwish@garner.com")

    response = await client.post(ACCEPT_URL, headers=someone_else, json={"token": token})

    assert response.status_code == 403


async def test_an_expired_link_is_refused(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    async with SessionLocal() as session:
        await session.execute(
            update(CompanyInvite).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    bilal = await sign_up(client, "bilal.khan@garner.com")

    response = await client.post(ACCEPT_URL, headers=bilal, json={"token": token})
    listed = (await client.get(INVITES_URL, headers=owner)).json()

    assert response.status_code == 404
    assert listed[0]["status"] == "expired"


async def test_a_revoked_link_stops_working(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    invite_id = (await client.get(INVITES_URL, headers=owner)).json()[0]["id"]

    revoked = await client.delete(f"{INVITES_URL}/{invite_id}", headers=owner)
    preview = await client.post(PREVIEW_URL, json={"token": token})

    assert revoked.status_code == 204
    assert preview.status_code == 404


async def test_an_existing_teammate_cannot_be_invited(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    bilal = await sign_up(client, "bilal.khan@garner.com")
    await client.post(ACCEPT_URL, headers=bilal, json={"token": token})

    response = await client.post(INVITES_URL, headers=owner, json=BILAL)

    assert response.status_code == 409


async def test_invites_need_a_company_and_the_right_role(
    client: AsyncClient, clean_users_table: None, sender: RecordingSender
) -> None:
    owner = await garner_owner(client, sender)
    token = await _invite(client, owner, sender)
    bilal = await sign_up(client, "bilal.khan@garner.com")
    await client.post(ACCEPT_URL, headers=bilal, json={"token": token})
    loner = await sign_up(client, "loner@example.com")

    as_hiring_manager = await client.post(
        INVITES_URL, headers=bilal, json={"email": "x@garner.com", "role": "interviewer"}
    )
    without_company = await client.get(INVITES_URL, headers=loner)
    without_token = await client.get(INVITES_URL)

    assert as_hiring_manager.status_code == 403
    assert without_company.status_code == 404
    assert without_token.status_code == 401

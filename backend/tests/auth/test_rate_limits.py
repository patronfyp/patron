"""Rate limits on sign-up, login, password reset and verification codes (#110, ADR 0021)."""

from httpx import AsyncClient

from app.core.rate_limit import VERIFICATION_SEND_PER_USER, RateLimiter
from tests.fakes import RecordingSender

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
RESET_URL = "/api/v1/auth/password-reset/request"
RESET_CONFIRM_URL = "/api/v1/auth/password-reset/confirm"
SEND_CODE_URL = "/api/v1/verification/email/send"

EMAIL = "ayesha@example.com"
PASSWORD = "secret123"


async def _register(client: AsyncClient, email: str = EMAIL) -> None:
    await client.post(
        REGISTER_URL,
        json={"email": email, "password": PASSWORD, "full_name": "Ayesha", "role": "candidate"},
    )


async def _login(client: AsyncClient, password: str, email: str = EMAIL) -> int:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    return response.status_code


async def test_five_wrong_passwords_lock_the_email_for_a_while(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    await _register(client)

    wrong = [await _login(client, "wrong-password") for _ in range(5)]
    locked = await client.post(LOGIN_URL, json={"email": EMAIL, "password": PASSWORD})

    assert wrong == [401] * 5
    assert locked.status_code == 429
    assert locked.json()["code"] == "too_many_requests"
    assert 0 < int(locked.headers["Retry-After"]) <= 15 * 60


async def test_a_correct_password_starts_the_count_over(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    await _register(client)
    for _ in range(4):
        await _login(client, "wrong-password")

    signed_in = await _login(client, PASSWORD)
    again = [await _login(client, "wrong-password") for _ in range(4)]

    assert signed_in == 200
    assert again == [401] * 4


async def test_the_lock_is_per_email_and_says_nothing_about_the_account(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    await _register(client)
    await _register(client, "bilal@example.com")
    for _ in range(5):
        await _login(client, "wrong", "nobody@example.com")

    unknown = await client.post(LOGIN_URL, json={"email": "nobody@example.com", "password": "x"})
    other = await _login(client, PASSWORD, "bilal@example.com")

    # An unknown email locks exactly like a real one, so a 429 reveals nothing.
    assert unknown.status_code == 429
    assert other == 200


async def test_one_ip_can_sign_up_five_times_an_hour(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    statuses = [
        (
            await client.post(
                REGISTER_URL,
                json={
                    "email": f"user{n}@example.com",
                    "password": PASSWORD,
                    "full_name": "User",
                    "role": "candidate",
                },
            )
        ).status_code
        for n in range(6)
    ]

    assert statuses == [201] * 5 + [429]


async def test_reset_emails_are_limited_per_address(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter, sender: RecordingSender
) -> None:
    await _register(client)

    statuses = [(await client.post(RESET_URL, json={"email": EMAIL})).status_code for _ in range(4)]

    assert statuses == [202, 202, 202, 429]
    # The reset service's own resend cooldown still sends just one email a minute.
    assert len(sender.sent) == 1


async def test_reset_links_cannot_be_guessed_in_bulk(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter
) -> None:
    statuses = [
        (
            await client.post(
                RESET_CONFIRM_URL, json={"token": f"guess-{n}", "new_password": "new-secret-1"}
            )
        ).status_code
        for n in range(11)
    ]

    assert statuses == [400] * 10 + [429]


async def test_verification_codes_are_limited_per_user(
    client: AsyncClient, clean_users_table: None, limiter: RateLimiter, sender: RecordingSender
) -> None:
    await _register(client)
    token = (await client.post(LOGIN_URL, json={"email": EMAIL, "password": PASSWORD})).json()
    headers = {"Authorization": f"Bearer {token['access_token']}"}
    user_id = (await client.get(ME_URL, headers=headers)).json()["id"]
    for _ in range(VERIFICATION_SEND_PER_USER.max_attempts):
        await limiter.hit(VERIFICATION_SEND_PER_USER, user_id)

    response = await client.post(
        SEND_CODE_URL, headers=headers, json={"email": EMAIL, "kind": "account"}
    )

    assert response.status_code == 429
    assert sender.sent == []

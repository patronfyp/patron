"""Tests for the profile photo and CV uploads - the Profile and CV onboarding steps."""

from conftest import MemoryStorage
from httpx import AsyncClient

from app.core.uploads import MAX_UPLOAD_BYTES

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
PROFILE_URL = "/api/v1/profile/me"
PHOTO_URL = "/api/v1/profile/me/photo"
CV_URL = "/api/v1/profile/me/cv"

_PASSWORD = "secret123"

# The first bytes are what the server checks - the rest can be anything.
_PNG = b"\x89PNG\r\n\x1a\n" + b"rest-of-image"
_JPEG = b"\xff\xd8\xff" + b"rest-of-image"
_PDF = b"%PDF-1.7\n" + b"rest-of-document"
_DOCX = b"PK\x03\x04" + b"rest-of-document"


async def _sign_in(client: AsyncClient, email: str = "files@example.com") -> dict:
    await client.post(
        REGISTER_URL,
        json={"email": email, "password": _PASSWORD, "full_name": "Files", "role": "candidate"},
    )
    login = await client.post(LOGIN_URL, json={"email": email, "password": _PASSWORD})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _file(name: str, data: bytes, content_type: str = "application/octet-stream") -> dict:
    return {"file": (name, data, content_type)}


async def test_uploads_require_a_token(client: AsyncClient, storage: MemoryStorage) -> None:
    assert (await client.put(PHOTO_URL, files=_file("me.png", _PNG))).status_code == 401
    assert (await client.put(CV_URL, files=_file("cv.pdf", _PDF))).status_code == 401
    assert (await client.get(CV_URL)).status_code == 401


async def test_photo_upload_returns_a_url_that_serves_the_photo(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.put(PHOTO_URL, headers=headers, files=_file("me.png", _PNG))

    assert response.status_code == 200
    photo_url = response.json()["photo_url"]
    assert photo_url.startswith("/api/v1/profile/photos/")
    served = await client.get(photo_url)  # public - no token
    assert served.status_code == 200
    assert served.content == _PNG
    assert served.headers["content-type"] == "image/png"


async def test_a_new_photo_replaces_and_deletes_the_old_one(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)
    first = await client.put(PHOTO_URL, headers=headers, files=_file("a.png", _PNG))

    second = await client.put(PHOTO_URL, headers=headers, files=_file("b.jpg", _JPEG))

    assert second.json()["photo_url"] != first.json()["photo_url"]
    assert (await client.get(first.json()["photo_url"])).status_code == 404
    assert len(storage.files) == 1


async def test_photo_type_comes_from_the_bytes_not_the_name(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    """A PDF renamed to .png is still a PDF."""
    headers = await _sign_in(client)

    response = await client.put(
        PHOTO_URL, headers=headers, files=_file("me.png", _PDF, "image/png")
    )

    assert response.status_code == 422
    assert storage.files == {}


async def test_removing_the_photo(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)
    await client.put(PHOTO_URL, headers=headers, files=_file("me.png", _PNG))

    response = await client.delete(PHOTO_URL, headers=headers)

    assert response.status_code == 200
    assert response.json()["photo_url"] is None
    assert storage.files == {}


async def test_an_unknown_photo_name_is_404(client: AsyncClient, storage: MemoryStorage) -> None:
    missing = await client.get("/api/v1/profile/photos/00000000-0000-0000-0000-000000000000.png")
    traversal = await client.get("/api/v1/profile/photos/..%2F..%2Fsecret.png")

    assert missing.status_code == 404
    assert traversal.status_code == 404


async def test_cv_upload_shows_its_details_and_can_be_downloaded(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.put(
        CV_URL, headers=headers, files=_file("Abdul_Rafay_CV.pdf", _PDF, "application/pdf")
    )

    assert response.status_code == 200
    cv = response.json()["cv"]
    assert cv["filename"] == "Abdul_Rafay_CV.pdf"
    assert cv["size_bytes"] == len(_PDF)
    download = await client.get(CV_URL, headers=headers)
    assert download.status_code == 200
    assert download.content == _PDF
    assert "Abdul_Rafay_CV.pdf" in download.headers["content-disposition"]


async def test_cv_accepts_docx(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.put(CV_URL, headers=headers, files=_file("cv.docx", _DOCX))

    assert response.status_code == 200


async def test_cv_rejects_images_and_oversized_files(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    image = await client.put(CV_URL, headers=headers, files=_file("cv.pdf", _PNG))
    too_big = await client.put(
        CV_URL, headers=headers, files=_file("cv.pdf", _PDF + b"x" * MAX_UPLOAD_BYTES)
    )
    empty = await client.put(CV_URL, headers=headers, files=_file("cv.pdf", b""))

    assert image.status_code == 422
    assert too_big.status_code == 422
    assert empty.status_code == 422
    assert storage.files == {}


async def test_a_cv_is_private_to_its_owner(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    alice = await _sign_in(client, "alice@example.com")
    bob = await _sign_in(client, "bob@example.com")
    await client.put(CV_URL, headers=alice, files=_file("alice.pdf", _PDF))

    response = await client.get(CV_URL, headers=bob)

    assert response.status_code == 404


async def test_removing_the_cv(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)
    await client.put(CV_URL, headers=headers, files=_file("cv.pdf", _PDF))

    response = await client.delete(CV_URL, headers=headers)

    assert response.json()["cv"] is None
    assert storage.files == {}
    assert (await client.get(CV_URL, headers=headers)).status_code == 404


async def test_the_client_file_path_is_not_kept(
    client: AsyncClient, clean_users_table: None, storage: MemoryStorage
) -> None:
    headers = await _sign_in(client)

    response = await client.put(
        CV_URL, headers=headers, files=_file("C:\\Users\\abdul\\Desktop\\cv.pdf", _PDF)
    )

    assert response.json()["cv"]["filename"] == "cv.pdf"

"""Checking uploaded files before they are stored.

The browser's content type and the file name are both chosen by the client,
so neither is trusted: the type is read from the file's first bytes instead.
A file renamed from `virus.exe` to `cv.pdf` is refused here.
"""

from enum import StrEnum

from fastapi import UploadFile

from app.core.exceptions import UnprocessableError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # "up to 5 MB" on the Figma CV step


class FileKind(StrEnum):
    """The file types PATRON accepts. The value is the stored extension."""

    PDF = "pdf"
    DOCX = "docx"
    JPEG = "jpg"
    PNG = "png"


# How each type starts. DOCX is a ZIP archive, so it starts like any ZIP.
_SIGNATURES: dict[FileKind, bytes] = {
    FileKind.PDF: b"%PDF-",
    FileKind.DOCX: b"PK\x03\x04",
    FileKind.JPEG: b"\xff\xd8\xff",
    FileKind.PNG: b"\x89PNG\r\n\x1a\n",
}

CONTENT_TYPES: dict[FileKind, str] = {
    FileKind.PDF: "application/pdf",
    FileKind.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    FileKind.JPEG: "image/jpeg",
    FileKind.PNG: "image/png",
}


def _detect(data: bytes) -> FileKind | None:
    for kind, signature in _SIGNATURES.items():
        if data.startswith(signature):
            return kind
    return None


async def read_upload(
    file: UploadFile, allowed: set[FileKind], *, description: str
) -> tuple[bytes, FileKind]:
    """Read an upload and return its bytes and real type, or raise 422.

    `description` names the accepted types in the error, e.g. "a PDF or
    DOCX file". Reads at most one byte past the limit, so an oversized upload
    is refused without loading all of it into memory.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise UnprocessableError("The file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UnprocessableError("The file is larger than 5 MB.")

    kind = _detect(data)
    if kind is None or kind not in allowed:
        raise UnprocessableError(f"Upload {description}.")
    return data, kind

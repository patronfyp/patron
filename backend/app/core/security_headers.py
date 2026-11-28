"""Security headers on every response (audit 2026-11-28, finding 3).

They tell the browser how to treat what we send: don't sniff file types, don't
be framed by another site (clickjacking), only use HTTPS, send no referrer to
other sites, and run no scripts from a response that is only JSON or a file.
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# The API serves JSON and files, never pages, so nothing needs to load or be
# framed. The docs UI (/docs, /redoc) loads its own scripts and is relaxed below.
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_DOCS_CSP = (
    "default-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; frame-ancestors 'none'"
)
_DOCS_PATHS = ("/docs", "/redoc")

_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    # Two years, subdomains too. Browsers ignore it over plain HTTP, so it is
    # harmless in local development.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Referrer-Policy": "no-referrer",
    # No camera, microphone or location from an API response.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for name, value in _HEADERS.items():
            response.headers.setdefault(name, value)
        is_docs = request.url.path.startswith(_DOCS_PATHS)
        response.headers.setdefault("Content-Security-Policy", _DOCS_CSP if is_docs else _API_CSP)
        return response

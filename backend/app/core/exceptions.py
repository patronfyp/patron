"""Our own exception hierarchy.

Services raise these; a single handler in main.py turns them into HTTP
responses, so no route ever builds an error response by hand and every error
looks the same shape on the wire. STANDARDS.md §3.7.
"""


class AppError(Exception):
    """Base for every error we raise deliberately."""

    status_code = 500
    code = "internal_error"

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"


class TooManyRequestsError(AppError):
    status_code = 429
    code = "too_many_requests"


class ServiceUnavailableError(AppError):
    """An outside service we depend on (e.g. the email provider) failed."""

    status_code = 503
    code = "service_unavailable"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class UnprocessableError(AppError):
    """The request was well-formed but breaks a business rule."""

    status_code = 422
    code = "unprocessable"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"

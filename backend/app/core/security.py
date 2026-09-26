"""Password hashing.

Nothing else touches bcrypt directly - every code path that needs to hash or
check a password goes through these two functions, so the algorithm can be
changed in one place later if needed.

We use the `bcrypt` library directly rather than passlib. passlib's bcrypt
wrapper has been broken since bcrypt 4.1 (it probes `bcrypt.__about__`, which
that release removed) and passlib itself has had no release since 2020 - so
"the standard way to do this in Python" is no longer a safe assumption to
build on. Direct use of `bcrypt` is what current guidance recommends instead.
"""

import bcrypt

# bcrypt silently truncates any input past 72 bytes - a password entered past
# that point would be ignored rather than rejected, which is worse than just
# refusing it. Enforced in RegisterRequest (schemas.py) as `max_length=72` on
# the ASCII case; comfortably above what any real password needs.
_BCRYPT_MAX_BYTES = 72


def hash_password(plain_password: str) -> str:
    """Hash a password for storage. Never store or log the plain value."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain password against a stored hash."""
    password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))

# ADR 0021: Redis for rate limiting, failing open

- **Status:** accepted
- **Date:** 2026-11-19
- **Decision by:** Rafay

## Context

STANDARDS.md §6 rule 9 says auth endpoints are rate-limited, but until now
only two had limits (the 60-second resend cooldowns on verification codes and
company invites, stored in Postgres). Login had none: anyone could try
passwords for an account without end (#110).

A limit is a counter that has to be shared by every API process, survive a
restart, and disappear on its own when its window ends. The background queue
(#113) and real-time updates (Module 11.4) will need a shared, fast store too.

## Decision

1. **Counters live in Redis**, one key per limit and person:
   `rl:<scope>:<sha256 of the email, user id or IP>`. The first attempt sets an
   expiry of one window (`INCR` + `EXPIRE NX` in one transaction), so the
   count resets on its own. Emails and IPs are hashed, never stored plainly.
2. **The limits** (`app/core/rate_limit.py`):

   | Scope | Limit |
   |---|---|
   | Wrong passwords per email | 5 / 15 min - a correct login clears it |
   | Login attempts per IP | 30 / 15 min |
   | Sign-ups per IP | 5 / hour |
   | Reset emails per address / per IP | 3 / hour, 20 / hour |
   | Reset-link attempts per IP | 10 / 15 min |
   | Verification codes per user | 10 / hour |

   Per-IP limits are loose because a campus or office shares one address.
   Verification-code *guessing* is already stopped by the 5-tries lock on each
   code; the per-user send limit caps how many codes, and so guesses, exist.
3. **Over the limit is a 429** `{detail, code: "too_many_requests"}` with a
   `Retry-After` header (exposed through CORS). An unknown email locks exactly
   like a real one, so a 429 never reveals whether an account exists.
4. **Fail open.** If Redis is down or slow (0.5 s timeout), the request goes
   through and a warning is logged. An empty `REDIS_URL` turns limits off.
5. **Tests use fakeredis.** Limits are off by default in tests; the tests of
   the limits turn them on with the `limiter` fixture.

## Consequences

**Positive**
- Password guessing and email flooding are capped, with no database writes.
- One shared counter for every process, ready for more than one server.
- The same Redis is ready for the background queue and real-time updates.

**Negative**
- One more service to run: Docker locally, a managed Redis in production.
- Failing open means an outage also switches the limits off; the warning in
  the log is how we notice.
- Locking by email lets someone lock a victim out for up to 15 minutes by
  guessing on purpose. That is the usual trade-off for stopping guessing.
- Behind a proxy, `request.client.host` is the proxy's IP; deployment (#114)
  must enable uvicorn's `--proxy-headers` with the proxy's address trusted.

## Alternatives considered
- **Counters in Postgres** - rejected: a write on every login attempt, and
  expired rows need cleaning up.
- **Counters in process memory** - rejected: reset on every restart, and each
  server process would keep its own count.
- **A library (slowapi)** - rejected: its decorators can't count only wrong
  passwords, and the whole limiter is about 100 lines we can read.
- **Fail closed** - rejected: a Redis outage would stop everyone signing in.

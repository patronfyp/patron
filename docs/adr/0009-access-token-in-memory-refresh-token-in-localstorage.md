# ADR 0009: Access token in memory, refresh token in localStorage

- **Status:** accepted
- **Date:** 2026-09-27
- **Decision by:** Rohan
- **Supersedes:** —

## Context
Issue #19 (Login page and auth store) requires that a session survive a page
refresh, and that the access token not be stored where any script can read it
casually. `/auth/login` (#15) returns a short-lived access token (15 min) and a
longer-lived refresh token (7 days) as plain JSON - there is no httpOnly cookie
option today, and adding one means the backend sets and reads cookies instead
of returning tokens in the response body, which is a backend-owned change
outside this issue.

Three storage options exist for the access token:

- **localStorage** - trivially persists across a refresh, but any script
  running on the page (a dependency, an XSS payload) can read it directly.
- **In-memory only** (a plain JS variable, or a zustand store with no persist
  middleware) - invisible to any script that isn't the app itself, but wiped
  on every page refresh.
- **httpOnly cookie** - not readable by JavaScript at all, the standard answer
  for this problem, but requires the backend to issue and accept cookies
  instead of returning tokens in the response body. Out of scope here.

## Decision
Keep the **access token in memory only** (the zustand `authStore`, no persist
middleware) and keep the **refresh token in `localStorage`**.

On app load, if a refresh token is present in `localStorage`, silently call
`POST /api/v1/auth/refresh` to obtain a fresh access token before rendering
protected routes. This is what makes the session survive a refresh without
ever writing the access token to disk.

## Consequences

**Positive**
- The access token - the one credential that authorises every API request -
  is never written to disk and cannot be read from a browser devtools
  Application tab or a stolen backup; it only exists in the page's memory for
  as long as the tab is open.
- No backend change needed; works with the JSON token response `/auth/login`
  already returns.
- Session still survives a refresh, tab close/reopen, and a new tab.

**Negative**
- The refresh token itself is still in localStorage, so it is readable by any
  script that can execute on the page (the same XSS risk as storing the access
  token there, just with a longer-lived credential).
- App load now has a brief "checking session" moment while the silent refresh
  call is in flight, before protected routes can render.
- If the refresh call fails (expired or missing token), the app must fall back
  to `/login` cleanly rather than getting stuck loading.

**Mitigation**
- The refresh token alone cannot call any endpoint except `/auth/refresh` -
  the backend rejects it everywhere else by its token-type claim (#15's
  acceptance criteria) - so stealing it is strictly less useful than stealing
  the access token would be.
- The standard defence against XSS reading localStorage at all is not storing
  anything sensitive there un-mitigated - that is the httpOnly-cookie answer.
  Revisit this ADR if/when the backend adopts cookie-based sessions.

## Alternatives considered
- **Both tokens in localStorage** - simplest to implement, rejected because it
  leaves the access token - the credential that authorises every request, not
  just one refresh - exposed for its whole 15-minute lifetime.
- **httpOnly cookies for both tokens** - the strongest option, rejected for now
  because it needs a coordinated backend change (issuing/reading cookies,
  CSRF protection) that is out of scope for a frontend issue. Worth revisiting
  once the team has bandwidth for that backend work.

# ADR 0014: No PKCE for LinkedIn sign-in

- **Status:** accepted
- **Date:** 2026-10-01
- **Decision by:** Rafay
- **Supersedes:** —

## Context

Issue #25's acceptance criteria require PKCE (`code_verifier` / `code_challenge`,
S256) on the LinkedIn OAuth flow, alongside `state`-based CSRF protection. Both
were implemented and initially shipped together.

Manual end-to-end testing against the real LinkedIn app (not a mock) found
that the token exchange - `POST https://www.linkedin.com/oauth/v2/accessToken`
with a `code_verifier` in the body - consistently failed:

```json
{"error": "invalid_client", "error_description": "Client authentication failed"}
```

This looked like a credentials problem (wrong `client_id`/`client_secret`) and
was investigated as one: the secret was re-copied fresh from the LinkedIn
Developer Portal's Auth tab, verified byte-for-byte via a hex dump against
`.env` (no stray whitespace or encoding issue), and the "Sign In with LinkedIn
using OpenID Connect" product was confirmed as **Added** (not just available)
under Products. None of that changed the result.

Removing `code_verifier` from the token request (and `code_challenge` /
`code_challenge_method` from the authorize URL) while keeping everything else
identical - same client credentials, same code, same request - made the
exchange succeed immediately. LinkedIn's token endpoint rejects a request
carrying a `code_verifier` with the generic client-authentication error
rather than a PKCE-specific one, which is why this surfaced as looking like a
credentials bug rather than an unsupported-parameter one, and why it needed
to be found by testing against the real endpoint rather than from LinkedIn's
documentation.

(A separate, now-resolved issue was found and fixed along the way: the
frontend's axios client needed `withCredentials: true` for the cross-origin
`GET /auth/linkedin/authorize` call's `Set-Cookie` to actually be stored by
the browser. That was a real bug on this project's side and is unrelated to
the PKCE finding above.)

## Decision

Do not use PKCE for the LinkedIn OAuth flow. `build_authorize_url` sends no
`code_challenge`; the token exchange sends no `code_verifier`.

CSRF protection is unaffected - the `state` token is still generated per
request, still carried in an httpOnly cookie, and the callback still rejects
a request where the cookie and the `state` query parameter don't match
exactly (see `linkedin.py`, `decode_state_token`). That mechanism never
depended on PKCE.

## Consequences

**Positive**
- LinkedIn sign-in actually works against the real API, confirmed by manual
  end-to-end testing, not just mocked unit tests.
- One less moving part (PKCE's verifier/challenge pair) in a flow that's
  already stateless-cookie-based for CSRF.

**Negative**
- Deviates from issue #25's literal acceptance criteria ("PKCE used"). Flagging
  this explicitly rather than quietly shipping without it, same as ADR 0013
  does for the headline-import gap.
- PKCE's specific protection - defending the authorization code against
  interception between LinkedIn's redirect and the token exchange - is not
  present. This is a smaller gap than it would be for a public client: the
  code exchange happens server-to-server, authenticated with `client_secret`,
  which a browser-side attacker who merely observes the redirected `code`
  (e.g. via browser history or a shared machine) does not have. PKCE is
  primarily there for clients that *can't* hold a secret (mobile apps, SPAs
  doing the exchange themselves) - this backend can and does.
- If LinkedIn's API behaviour here was a transient bug rather than a real
  limitation of this product tier, this decision may be worth revisiting
  later - re-test before assuming it's permanent if LinkedIn's OAuth
  implementation changes.

## Alternatives considered

- **Keep investigating why PKCE fails instead of dropping it** - the
  credentials and product-activation checks already ruled out the likely
  causes, and #25 was already late in the sprint; the state+cookie CSRF
  protection is the security-critical piece of the acceptance criteria and
  was unaffected either way.
- **Send `code_verifier` via a different transport (e.g. a header) in case
  it's a parameter-location issue, not an unsupported-feature issue** - the
  one concrete test actually run (HTTP Basic Auth for `client_id`/
  `client_secret` instead of body params) surfaced a *different* LinkedIn
  error ("A required parameter `client_secret` is missing"), confirming
  LinkedIn wants client credentials in the body specifically - not that
  `code_verifier` placement was the issue. Removing `code_verifier` entirely
  is what resolved it.

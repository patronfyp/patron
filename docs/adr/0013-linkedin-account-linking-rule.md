# ADR 0013: Email-verified account linking for LinkedIn sign-in

- **Status:** accepted
- **Date:** 2026-09-30
- **Decision by:** Rafay
- **Supersedes:** —

## Context

A person can reach Patron two ways: register with email + password (#14), or
sign in with LinkedIn (#25, the primary route). The same person might do
both - register first, then later click "Continue with LinkedIn" - and
should end up in the same account, not two.

`UserIdentity` matches a returning LinkedIn sign-in on `(provider,
provider_user_id)`, never on email (models.py) - a person can change their
email at LinkedIn, and a stale match would silently move their account under
someone else. But the *first* time a given LinkedIn identity is seen, there
is no `(provider, provider_user_id)` row to match yet, and a decision has to
be made: is this a brand new person, or an existing Patron user who hasn't
linked LinkedIn before?

The naive answer - "if the emails match, it's the same person, link them" -
is a real account-takeover route. LinkedIn's OpenID Connect response
includes an `email_verified` claim precisely because a provider's email
field is not proof of ownership by itself in every provider's flow;
trusting it unconditionally would mean anyone who can get *any* string into
LinkedIn's email field for their own account could claim a victim's address
and be silently linked into the victim's existing Patron account.

## Decision

```
LinkedIn callback
  |
  identity exists for (linkedin, sub)?  -> yes -> log in
  |  no
  user exists with this email?
  |  no  -> create user + identity, log in
  |  yes
  did LinkedIn report email_verified = true?
       yes -> attach identity to that user, log in
       no  -> refuse. Tell the user to sign in with their password instead.
```

Implemented as `service.login_with_linkedin` (app/modules/auth/service.py),
called from `GET /auth/linkedin/callback` after the code exchange. The
refusal is a `ConflictError` (409) with a message pointing the user at the
fallback path (#14) - it is not a dead end, just not an automatic one.

## Consequences

**Positive**
- Closes the account-takeover route described above: an attacker cannot get
  into a victim's existing account just by putting the victim's email
  address into their own LinkedIn profile.
- One person, one account, even across two different sign-in methods - the
  actual product requirement.
- The rule is one function or so, and is directly exercised by tests
  covering all four branches - new user, returning identity, verified
  linking, unverified refusal (tests/test_auth_linkedin.py).

**Negative**
- A user whose LinkedIn email is genuinely unverified (rare - LinkedIn
  verifies email at signup for most accounts) cannot self-link and has to
  fall back to registering separately or verifying their email at LinkedIn
  first. Accepted: the alternative is a real security hole, not an edge case
  worth trading it away for.
- `provider_email` is stored on `UserIdentity` for reference but is never
  authoritative - `User.email` can drift from it over time (either address
  can change independently after linking), and nothing here reconciles
  them. Not needed for #25's scope; revisit if a future feature needs the
  two to agree.

## Alternatives considered

- **Match on email alone, no verification check** - rejected. This is the
  account-takeover route described in Context; not an acceptable trade for
  the sign-up friction it would save.
- **Never auto-link; always require the user to explicitly confirm linking
  from within a signed-in session** - more conservative, but adds a whole
  confirmation UI for a case (verified email match) where the risk is
  already closed by the `email_verified` check. Rejected as unnecessary
  friction for #25's scope; worth reconsidering if a future provider's
  "verified" claim turns out to be less trustworthy than LinkedIn's.
- **Match on `(provider, provider_user_id)` only, treat every new LinkedIn
  identity as a new user, let the user merge accounts manually later** -
  rejected. Patron has no account-merge feature, so this would strand
  people with two accounts and no way to combine their history.

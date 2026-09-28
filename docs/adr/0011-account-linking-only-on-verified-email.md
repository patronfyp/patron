# ADR 0011: Account linking only on a provider-verified email

- **Status:** accepted
- **Date:** 2026-09-15
- **Decision by:** Rafay
- **Supersedes:** —

## Context

When a visitor signs in with LinkedIn (#25), three cases are possible: the
`(provider, provider_user_id)` identity already exists (log in), no account
matches at all (create one), or a `users` row already exists with the same
email — created earlier through the password path (#14). That third case
needs a rule: does the LinkedIn identity get attached to that existing
account, or not?

## The attack this prevents

LinkedIn reports an email on every profile, but does not always confirm the
account holder actually controls that mailbox. If Patron trusted any
LinkedIn-reported email and linked it to a matching existing account, an
attacker could create a LinkedIn profile using a victim's email address (no
mailbox access required to put a string in a profile field) and sign in to
Patron as the victim — a full account takeover with no password guessing
and no phishing needed. This is a known account-takeover pattern for OAuth
"login with X" flows, not a hypothetical one.

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
       no  -> REFUSE. Tell the user to sign in with their password instead.
```

An existing account is linked to a LinkedIn identity **only** when LinkedIn's
own OpenID Connect response reports `email_verified: true` for that email.
If it reports `false`, or omits the claim, linking is refused outright — the
user is told to use their password instead, and no account is modified.

## Consequences

**Positive**
- Closes the account-takeover route described above: an attacker cannot
  claim an unverified email on LinkedIn and ride it into an existing Patron
  account.
- The rule is a single boolean check on a claim LinkedIn already provides —
  no extra verification flow to build.

**Negative**
- A legitimate user whose LinkedIn email genuinely is unverified (rare, but
  possible if they added a new email to LinkedIn recently) is blocked from
  linking until they verify it on LinkedIn's side — outside Patron's
  control. They can still sign in with their password in the meantime.
- Adds a branch to the LinkedIn callback flow that must be tested explicitly
  (#25's acceptance criteria lists this as its own test case), not just
  happy-path login.

## Alternatives considered
- **Link on email match regardless of verification status** — rejected.
  This is exactly the account-takeover route described above; convenience
  for the rare unverified-email case is not worth the security hole.
- **Never auto-link; always create a second account for a new provider on
  the same email** — rejected. Leaves a user with two disconnected accounts
  (one password-based, one LinkedIn-based) with no way to merge them,
  which is confusing and was explicitly ruled out as unhelpful in favour of
  the verified-email check.
- **Require the user to manually confirm linking via a code sent to their
  email** — rejected for now as unnecessary extra friction; LinkedIn's own
  `email_verified` claim already establishes the same guarantee without an
  extra step. Revisit if LinkedIn's claim proves unreliable in practice.

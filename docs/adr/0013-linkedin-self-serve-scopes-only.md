# ADR 0013: LinkedIn self-serve scopes only — Modules 1.1 and 2.9 rescoped

- **Status:** accepted
- **Date:** 2026-09-19
- **Decision by:** Rafay
- **Supersedes:** —

> **Numbering note:** originally planned as ADR 0011 (issue #24), shifted to
> the next free number because 0011 and 0012 were already taken by the time
> this was written up — see the note in ADR 0010.

## Context

Module 1.1's spec assumed LinkedIn sign-in "imports name, photo, headline",
and Module 2.9 (CV builder) assumed a LinkedIn import could pull positions,
education and skills. Before building either, the actual LinkedIn developer
app was set up to confirm what the API allows self-serve, rather than
assuming.

**Confirmed, not assumed** (app `Patron`, client ID `77wmh31632z1cs`,
Standalone type): only the **Sign In with LinkedIn using OpenID Connect**
product (Standard Tier) is self-serve. Its three grantable scopes are
`openid`, `profile`, `email`.

| Field | Available with these scopes |
|---|---|
| `sub` (stable user id) | yes |
| name, given_name, family_name | yes |
| picture (avatar URL) | yes |
| email + `email_verified` | yes |
| **headline** | **no** |
| positions, education, skills | **no** |

Everything beyond that table (Advertising API, Lead Sync, Matched Audiences,
Events Management, and any product that would expose headline, positions,
education or skills) requires LinkedIn's Partner Program, which needs an
approval process not realistically obtainable for this project in its
timeline.

## Decision

Build LinkedIn OAuth (#25) against only the confirmed self-serve fields:
`sub`, name, `picture`, `email`, `email_verified`. Rescope the two features
that assumed more:

- **Module 1.1** — drop "imports headline" from the sign-up flow. The
  headline becomes a field the user fills in manually on the profile screen
  (Sprint 2), not something LinkedIn supplies.
- **Module 2.9** ("Import from LinkedIn" for the CV builder) — **not
  achievable** with self-serve scopes at all, since positions, education and
  skills are Partner Program-only. This needs rescoping with the supervisor
  before Sprint 13, when the CV builder is built.

## Consequences

**Positive**
- The written record shows these two features were cut for a real, external
  API limitation — confirmed against the actual LinkedIn developer console —
  not because the team ran out of time or didn't try.
- Nobody re-plans Module 1.1 or 2.9 around a LinkedIn import capability that
  cannot exist without an approval process outside this project's control.
- The redirect URI (`http://localhost:8000/api/v1/auth/linkedin/callback`)
  and the "exchange LinkedIn's token once, never store it" pattern were
  confirmed at the same time, closing out two other open questions in #25.

**Negative**
- Module 2.9 as originally specified cannot ship at all without Partner
  Program approval — a real scope reduction to the CV builder that must be
  raised with the supervisor, not quietly absorbed.
- The headline field, previously "free" via import, now needs its own
  profile-editing UI and validation that would not have been necessary if
  the import had worked as originally assumed.

## Alternatives considered
- **Apply for LinkedIn's Partner Program** to unlock headline/positions/
  education/skills — rejected for now. The approval process is not
  realistically obtainable within this project's timeline; revisit only if
  the supervisor considers Module 2.9 essential enough to justify the
  application and its wait time.
- **Scrape or otherwise obtain profile data outside the official API** —
  rejected outright. Violates LinkedIn's terms of service and is exactly the
  kind of decision that needs to be avoidable, not chosen, in a graded
  student project.

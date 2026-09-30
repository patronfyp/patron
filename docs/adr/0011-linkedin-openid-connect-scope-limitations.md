# ADR 0011: LinkedIn's self-serve scopes, not the Partner Program

- **Status:** accepted
- **Date:** 2026-09-30
- **Decision by:** Rafay
- **Supersedes:** —

## Context

Module 1.1's spec describes LinkedIn sign-in importing a user's headline;
Module 2.9 describes importing full profile data (positions, education,
skills) into the CV builder. Both assume access to LinkedIn's full profile
API, which requires LinkedIn's **Partner Program** - an approval process
aimed at established companies, not a student project, and not realistically
obtainable on this project's timeline.

What's actually self-serve, no approval needed, is the **"Sign In with
LinkedIn using OpenID Connect"** product, with three scopes: `openid`,
`profile`, `email`. Checked directly against
<https://www.linkedin.com/developers/apps> (Patron's app, Auth tab) before
building #25:

| Field | Available self-serve |
|---|---|
| `sub` (stable LinkedIn user id) | yes |
| `name`, `given_name`, `family_name` | yes |
| `picture` (avatar URL) | yes |
| `email`, `email_verified` | yes |
| headline | **no** |
| positions, education, skills | **no** |

LinkedIn can change which products are self-serve at any time - anyone
touching this integration later should re-check the Auth tab rather than
trust this table indefinitely.

## Decision

Build #25 (LinkedIn sign-in) against the OpenID Connect product and its three
scopes only. Do not build against, or block #25 on, the Partner Program.

Concretely:
- The user's headline is **not** imported at sign-up. They fill it in
  manually on the profile screen (Sprint 2).
- Module 2.9 ("Import from LinkedIn" for the CV builder) is **not
  achievable** as specified. It needs rescoping - raise it with the
  supervisor before Sprint 13, rather than silently dropping it or
  discovering the blocker mid-sprint.

## Consequences

**Positive**
- #25 ships on this project's actual timeline - no external approval
  dependency with an unknown or multi-week turnaround.
- `sub` + `email` + `email_verified` is exactly what the account-linking
  rule needs (see the account-linking ADR) - nothing in #25's security
  requirements is weakened by this scope choice.

**Negative**
- Two spec'd features (headline import, CV-builder LinkedIn import) are not
  achievable as written and need the supervisor's sign-off on a reduced or
  alternative scope.
- If LinkedIn tightens even the self-serve product later, sign-in itself
  could be affected - the Auth tab is the source of truth, not this table.

## Alternatives considered

- **Apply for the LinkedIn Partner Program** - rejected for now. Approval is
  not self-serve, is aimed at companies with an existing product and user
  base, and has no guaranteed timeline - a student FYP cannot safely depend
  on it shipping before a sprint deadline.
- **Scrape or otherwise access profile data outside LinkedIn's API** -
  rejected outright. Against LinkedIn's terms of service, and a security/
  legal risk with no upside proportionate to it.

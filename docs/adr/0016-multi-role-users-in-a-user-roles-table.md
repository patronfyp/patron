# ADR 0016: Multi-role users in a `user_roles` table

- **Status:** accepted
- **Date:** 2026-10-12
- **Decision by:** Rafay
- **Supersedes:** the original `users.role` column (candidate / company /
  both) - never written up as its own ADR, so there is nothing to mark
  superseded; this is the record for both the original choice and the
  change.

## Context

The original schema gave every user a single `role` column: `candidate`,
`company`, or `both`. Sprint 3's Figma designs introduced a fourth
distinction Patron actually needs: a `referrer` (an employee or alumnus who
refers people, regardless of whether they are also job-hunting) is not the
same thing as a `recruiter` (hiring for a company). "Company" conflated
"the person signing up on behalf of a company" with "a person who refers
candidates into one", and "both" could not express "candidate and
recruiter" versus "candidate and referrer" - real combinations the product
needs to tell apart.

A single enum column can express at most one role at a time (or, with
"both", exactly one fixed pair) - it cannot grow to new combinations of
roles without a new enum value for every combination.

## Decision

Replace `users.role` with a `user_roles` table: one row per
`(user_id, role)` pair, so a user can hold any combination of `candidate`,
`referrer` and `recruiter`. `admin` exists as a role too, but is never
self-assigned - only Patron staff can be granted it directly in the
database.

`POST /auth/register` accepts `candidate`, `referrer` or `recruiter` only.
`POST /auth/role` **adds** a role to the account instead of replacing
whatever was there; adding a role the user already holds is a no-op.
`UserRead` returns `roles: [...]`, plural, everywhere a single `role` used
to be returned.

## Consequences

**Positive**
- A user can be both a candidate and a referrer (the common case: someone
  job-hunting who also refers people into their own company) without an enum
  value for every combination.
- Matches the Figma role cards exactly (Get referred / Refer others / Hire
  talent), rather than the UI picking the closest-fitting value from an enum
  that does not match its own options.
- `admin` existing as a role, never self-assignable through the public API,
  means no separate `is_admin` flag or table is needed later.

**Negative**
- Every permission check that used to read one column now reads a set and
  checks membership (`"recruiter" in roles`) - more call sites touched than
  a column rename would have been.
- A second table and join wherever a user's roles are needed, instead of a
  column already on the row.

## Alternatives considered
- **Keep a single `role` enum, add a `both`-style value for every needed
  combination** (`candidate_referrer`, `candidate_recruiter`, ...) -
  rejected. The combinations grow combinatorially as more roles are added
  later (Module 13's admin tooling, for instance), and "both" already
  showed this doesn't scale past two roles.
- **A bitmask integer column** - rejected. Marginally cheaper to query than
  a join, but unreadable in the database shell and in logs compared to a
  `user_roles` row per role, for a save this project's scale will never
  notice.

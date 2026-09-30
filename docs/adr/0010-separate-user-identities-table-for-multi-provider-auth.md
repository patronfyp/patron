# ADR 0010: Separate `user_identities` table for multi-provider auth

- **Status:** accepted
- **Date:** 2026-09-26
- **Decision by:** Rafay
- **Supersedes:** —

> **Numbering note:** originally planned as ADR 0009 (issue #24), but 0009
> was already taken by ADR 0009 (access token in memory / refresh token in
> localStorage, decided by Rohan on the same date). Numbers are never
> reused, so this decision takes the next free number instead.

## Context

Patron needs email/password sign-up (#14, Module 1.2) now, and LinkedIn OAuth
(#25, Module 1.1) as the primary route once Sprint 2 starts, with room for
Google or GitHub later. The obvious shortcut is to put a `linkedin_sub`
column directly on `users` — but that means adding a `google_sub`, a
`github_sub` and a schema migration every time a provider is added, and most
of those columns would be `NULL` for most users.

## Decision

Keep two tables: `users` (the person — identity, profile, optional password)
and `user_identities` (one row per linked provider account, unique on
`(provider, provider_user_id)`, cascading delete on the user). A password
sign-up writes only to `users`; an OAuth sign-up writes to both. Adding a
provider is a new `AuthProvider` enum value and new rows, never a schema
change. This is the pattern Auth0, Supabase and NextAuth all use.

## Consequences

**Positive**
- Adding Google or GitHub sign-in later needs zero migration — just a new
  `AuthProvider` value and the OAuth handler.
- One account can hold several sign-in methods (e.g. a user who started with
  a password and later links LinkedIn) without any column on `users` ever
  being ambiguous about which provider it belongs to.
- `users.password` and `users.role` stay nullable for exactly the population
  that needs them nullable (LinkedIn-only users), which is documented and
  intentional rather than an accidental `NULL`.

**Negative**
- Every query that needs "how did this user sign up" is a join instead of a
  column read.
- The table sits empty until LinkedIn OAuth (#25) actually lands — a small
  amount of unused schema is created ahead of the feature that uses it. This
  was a deliberate trade documented in #13: creating it now, while the
  `users` table is still empty, avoids a nullable-to-NOT-NULL-and-back
  migration later on a populated table, which is a much riskier change.

## Alternatives considered
- **`linkedin_sub` (and future provider columns) directly on `users`** —
  rejected. Every new provider becomes a schema migration and a new nullable
  column that is `NULL` for every user who signed up a different way.
- **A single `provider` + `provider_user_id` pair of columns on `users`
  itself** (one provider per user, no separate table) — rejected. It cannot
  represent a user who signs in with more than one provider, which the
  account-linking rule (ADR 0011) requires.

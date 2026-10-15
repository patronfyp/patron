# ADR 0015: UUID primary keys instead of integers

- **Status:** accepted
- **Date:** 2026-10-12
- **Decision by:** Rafay
- **Supersedes:** —

## Context

All five tables that existed before Sprint 3 (`users`, `user_identities`,
`profiles`, `email_verifications`, `password_reset_tokens`) used integer
primary keys. Sprint 3 was about to add more tables that point at
`users.id` (profiles fields, verification documents, notifications), and
once real foreign-key chains exist, switching key types later means
recreating all of them at once instead of just these five.

An integer id is also guessable and countable: `/profile/42` or
`/users/43` leaks how many accounts exist and lets someone enumerate
every profile by incrementing a number in a URL.

## Decision

Move `users`, `user_identities`, `profiles`, `email_verifications` and
`password_reset_tokens` from integer to UUID primary keys, before Sprint 3
adds more tables that reference them.

A JWT's `sub` claim issued before this change is not a valid UUID; decoding
it now returns a 401 (an expired-looking session), not a 500.

## Consequences

**Positive**
- An id in a URL or a token can't be guessed or used to count how many
  users/profiles exist.
- Done now, before more foreign keys exist, so only five tables needed the
  migration instead of everything built in Sprints 4+.

**Negative**
- UUIDs are 16 bytes versus 4-8 for an integer — slightly larger indexes,
  irrelevant at this project's scale.
- Less readable in logs and the database shell than `user 42`.
- The migration **drops and recreates** the five tables rather than
  converting the column in place, since there was no real user data yet to
  preserve. A later schema change with real data would need a proper
  backfill migration instead.

## Alternatives considered
- **Keep integer ids, add a separate public UUID column for anything
  exposed in a URL** — rejected. Two id columns per table (an internal
  integer and an external UUID) is more complexity for every query and
  every foreign key than just using UUIDs everywhere.
- **Wait until enumeration is an actual reported problem** — rejected.
  More tables were about to start pointing at `users.id`; doing this after
  Sprint 3 would mean migrating many more tables at once.

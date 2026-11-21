# ADR 0023: Connections, and their type worked out from verified emails

- **Status:** accepted
- **Date:** 2026-11-21
- **Decision by:** Rafay

## Context

Connections (Module 3, #119) are the network every endorsement runs on: you
can only refer a connection (FR-3.1). Spec 3.9 adds a **connection type** -
Professional, Alumni or Both - which later decides which endorsements are
possible between two people (Sprints 7, 9 and 11).

The type has to be trustworthy (anyone could claim "we studied together") and
has to stay right when someone verifies a university or employer *after* they
connected.

## Decision

1. **The type comes from verified emails only**, the same ones behind the
   Verified Alumni / Verified Employee badges:
   - **Alumni** - both have a verified university email on the same domain
     (e.g. `@lums.edu.pk`).
   - **Both** - that, and a verified employer email on the same domain.
   - **Professional** - everything else.
2. **It is worked out on every read, never stored.** A stored type would go
   stale the moment either person verified something new. A list works it out
   for the whole page in one extra query.
3. **One row per connection.** `connections` keeps the pair with the smaller
   id in `user_a_id` (a CHECK enforces it), so A-B and B-A can't both exist.
4. **Requests are a separate table.** Accepting deletes the request and adds
   the connection in one commit. If both people ask each other, the second
   ask connects them.
5. **A decline is never revealed.** The sender keeps seeing "pending". After a
   decline or a withdrawal, the same sender waits 30 days to ask again, and at
   most 50 requests a day are allowed (ADR 0021).

## Consequences

**Positive**
- The type can't be faked and is always current.
- No backfill or migration when the rule changes - it is one function,
  `connections.service._types`.
- Endorsement code later asks one question ("what type is this connection?")
  and gets a trusted answer.

**Negative**
- Domains are compared exactly: `cs.lums.edu.pk` and `lums.edu.pk` count as
  different. Universities whose students use subdomains would need a mapping
  later.
- "Both" needs the *same employer*, so two alumni at different companies are
  Alumni, not Both. If 3.9 means "alumni who are also professionals", the rule
  changes in one place.
- Every read costs a small extra query on `email_verifications` (indexed by
  `user_id`).

## Alternatives considered
- **Store the type when the request is accepted** - rejected: goes stale.
- **Let users pick the type** - rejected: unverifiable, and endorsements trust it.
- **One table with a status for both requests and connections** - rejected:
  "my connections" and "my inbox" would filter the same big table, and a
  connected pair would still need ordering rules.

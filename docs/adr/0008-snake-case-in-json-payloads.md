# ADR 0008: snake_case in JSON payloads

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

Python, SQLAlchemy models and the database all use `snake_case`
(STANDARDS.md §5.1). JavaScript convention is `camelCase`. An API boundary
has to pick one casing to send over the wire, and the frontend has to either
match it or convert it.

## Decision

Keep `snake_case` over the wire — API JSON fields match Python and the
database exactly (e.g. `{"created_at": "..."}`), rather than converting to
`camelCase` at the API layer.

## Consequences

**Positive**
- A field has exactly one name everywhere: the database column, the
  Pydantic schema field, and the JSON key are identical. Nothing to
  translate when tracing a bug from a network tab back to a query.
- No casing-conversion layer to write, test, or forget to update when a
  field is renamed.

**Negative**
- Deviates from standard JavaScript/JSON convention — every frontend
  developer's muscle memory expects `camelCase`, so this has to be learned
  and enforced in review rather than assumed.
- Destructuring in JS reads slightly against the grain (`user.full_name`
  instead of `user.fullName`).

## Alternatives considered
- **Convert to `camelCase` at the API boundary** (e.g. a FastAPI response
  middleware, or a frontend interceptor) — rejected. It costs a whole class
  of "is it `createdAt` or `created_at` here?" bugs and a translation layer
  that has to be kept in sync with every schema change, to buy back
  JavaScript-idiom purity that isn't worth that cost.

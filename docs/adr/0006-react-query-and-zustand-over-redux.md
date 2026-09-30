# ADR 0006: React Query for server state, zustand for client state — Redux rejected

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

The frontend needs to hold two different kinds of state: data that comes
from the backend (jobs, profile, notifications) and data that is purely
client-side (the logged-in user object, dark mode, whether the sidebar is
collapsed). Redux is the traditional single answer to "where does app state
live", but it treats both kinds of state the same way, and needs
middleware (`redux-thunk` or `redux-saga`) to handle caching, refetching and
loading state for server data.

## Decision

Split state by where it comes from (STANDARDS.md §4.4, rule 8 in the 12
rules):

| The data | Tool |
|---|---|
| Came from the backend | **React Query** |
| UI-only, whole app | **zustand** |
| UI-only, one component | **`useState`** |

Never mix — server data does not go in a zustand store, and zustand stores
stay tiny.

## Consequences

**Positive**
- React Query gives caching, refetching, and loading/error state for free —
  the exact problem Redux middleware exists to solve, without writing that
  middleware.
- zustand stores stay small (auth user, theme) because anything fetched from
  the backend has nowhere else to go but React Query.
- Far less boilerplate per feature than Redux's actions/reducers/selectors
  for the same result.

**Negative**
- Two state tools instead of one means a new contributor has to learn the
  rule of which one to reach for — mitigated by the table in STANDARDS.md
  §4.4 and code review catching violations.
- No single "state tree" to inspect in one devtools panel; React Query and
  zustand each have their own devtools.

## Alternatives considered
- **Redux (with RTK Query)** — rejected. RTK Query solves the same
  server-state problem React Query does, but the team would still be
  carrying Redux's action/reducer/selector pattern for the client-only state
  that zustand handles with a single `create()` call.
- **One zustand store for everything, including server data** — rejected.
  Storing fetched data in zustand means hand-rolling cache invalidation and
  refetch-on-focus, which React Query already does correctly.

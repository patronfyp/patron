# ADR 0001: Monorepo over two repositories

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

The project needs a React frontend and a FastAPI backend. The usual
alternative to one repository holding both is two separate repositories, one
per service, each with its own history, issue tracker and CI pipeline.

The team is three people building fifteen sprints of tightly coupled
full-stack features — most sprint items touch both a backend endpoint and the
frontend screen that calls it. A three-person team also has no need for
independent release cadences or separate access control per service, which is
the usual reason to split repositories.

## Decision

One repository, `patron`, with `frontend/` and `backend/` as top-level
folders. Both are versioned together and a single PR can change an endpoint
and the screen that calls it.

## Consequences

**Positive**
- One feature = one PR, even when it touches both layers. No coordinating two
  PRs across two repositories for a single piece of work.
- One CI pipeline, one issue tracker, one place to look for anything.
- A single `git clone` gets a new contributor the whole system.

**Negative**
- Frontend and backend cannot be versioned or released independently — not a
  real cost for a project with one deployment target and no external API
  consumers.
- CI runs both frontend and backend checks on every PR, even ones that touch
  only one side, unless path filters are added later.

## Alternatives considered
- **Two repositories** (`patron-frontend`, `patron-backend`) — rejected. The
  coordination overhead (matching branches, opening two PRs per feature,
  linking issues across repos) buys independence this project has no use for.

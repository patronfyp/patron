# ADR 0005: uv over pip or Poetry

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

The backend needed a Python tooling choice for environments, dependencies
and lockfiles. `pip` alone needs a separate virtualenv tool and has no
lockfile. Poetry adds a lockfile and dependency resolution but is
noticeably slower and adds its own project-file conventions on top of
`pyproject.toml`.

## Decision

Use `uv` for Python version management, virtual environments, package
installs, and the lockfile (`uv.lock`).

## Consequences

**Positive**
- One tool replaces `pip` + `venv` + a separate lockfile manager.
- Fast enough that `uv sync` after a pull is not a chore — matters for a
  three-person team pulling `develop` daily.
- `uv run` runs project commands (`ruff`, `pytest`, `alembic`, `uvicorn`)
  inside the right environment without manual activation.

**Negative**
- Newer and less universally known than pip or Poetry — a contributor
  encountering `uv` for the first time needs the one-line install command
  from the README before anything else works.
- Smaller plugin/ecosystem footprint than pip, though nothing this project
  needs is missing.

## Alternatives considered
- **pip + venv** — rejected. No built-in lockfile; reproducing an exact
  environment across three machines means hand-maintaining `requirements.txt`
  pins.
- **Poetry** — rejected. Solves the lockfile problem but is slower in
  practice and introduces its own dependency-resolution quirks; uv gives the
  same guarantees with less friction.

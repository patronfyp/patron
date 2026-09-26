# Patron — instructions for Claude

Read this file fully before doing anything else in this repo.

## What this project is

A hiring platform (FYP) built on three trust mechanisms: Recommendations,
Employee Referrals, Alumni Referrals. Full context in `README.md`.

## Read these before writing code or docs

| Doc | When |
|---|---|
| `docs/STANDARDS.md` | before any code — architecture, naming, layer rules, Definition of Done |
| `docs/GIT_WORKFLOW.md` | before any branch/commit/PR |
| `docs/AGILE_PLAN.md` | sprints, roles, who owns what |
| `docs/DOCUMENTATION_GUIDE.md` | before writing SRS/ADR/docs |
| `docs/TESTING_GUIDE.md` | before writing tests |

Each starts with a "Start here" page — read that first.

## Non-negotiable rules

- Never push directly to `main` or `develop`. Always a `feature/*` branch → PR → 1 approval → squash merge.
- Never commit `.env`, `.env.local`, `node_modules/`, `.venv/`.
- Every PR: run `npm run lint && npm run build` (frontend) or `uv run ruff check . && uv run pytest` (backend) first.
- Every DB schema change ships with an Alembic migration in the same PR — never hand-edit the database.
- Follow the five-file backend module layout and the feature folder layout in `STANDARDS.md` §2.
- **Do not add a `Co-Authored-By: Claude` line to commits, or a "Generated with Claude Code" footer to PR descriptions.** This is a graded student project — commit authorship must reflect the person who wrote and reviewed the code, not the tool.
- When creating GitHub issues/PRs, check `docs/AGILE_PLAN.md` for the current sprint and assign correctly.

## Team

Rafay (`arafay044`) — lead, reviews every PR. Umair (`malikumairrrrrrrrrrrrrr`) — docs owner + dev. Rohan (`rohanpatron`) — dev.

Whoever is chatting with you, ask their name if unsure — advice on "my issue" or "what should I work on" depends on who's asking.

# Patron

> **Vouched, Verified, Hired** — a hiring platform built on three structurally
> separate trust mechanisms: **Recommendations**, **Employee Referrals**, and
> **Alumni Referrals**.

There is no "Apply" button. A candidate gets into a company's pipeline only when
someone vouches for them — a connection (Recommendation), a verified employee of
that company (Employee Referral), or a verified alumnus of their university
(Alumni Referral).

---

## Repository layout

```
patron/
├── frontend/     React 19 + Vite 8 (JavaScript) + Ant Design
├── backend/      FastAPI on Python 3.13, managed by uv
├── .editorconfig
├── .gitignore
└── README.md
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 | Vite is the current standard; CRA is deprecated |
| UI | Ant Design 6 | Form-, table- and dashboard-heavy product; antd covers Steps, Upload, Timeline, Kanban cards out of the box |
| Routing | react-router-dom 7 | |
| Server state | @tanstack/react-query 5 | caching, refetching, loading/error states |
| Client state | zustand | auth user, theme — Redux was considered and judged redundant here |
| HTTP | axios | interceptors for JWT refresh |
| Backend | FastAPI | async, automatic OpenAPI docs, Pydantic validation |
| Server | uvicorn | |
| Config | pydantic-settings | typed settings from `.env` |
| Python tooling | uv | one tool for Python versions, venv, packages, and a lockfile |
| Lint + format (JS) | ESLint 9 + Prettier | ESLint pinned to 9.x — see note below |
| Lint + format (Py) | ruff | replaces flake8 + black + isort + pylint |
| Tests | Vitest + Testing Library / pytest + httpx | |
| Database | PostgreSQL | *not wired up yet* |

> **Why ESLint 9 and not 10:** `eslint-plugin-jsx-a11y` and
> `eslint-plugin-import` do not support ESLint 10 yet. ESLint 10 removed
> internal APIs those plugins rely on, so installing it breaks `npm run lint`
> at runtime — not just a peer-dependency warning. We will upgrade once the
> plugins catch up.

---

## First-time setup

### 1. Prerequisites

| Tool | Get it from | Verify |
|---|---|---|
| Git | <https://git-scm.com/downloads> | `git --version` |
| Node.js LTS (20+) | <https://nodejs.org> | `node -v` |
| uv | command below | `uv --version` |

Install uv (PowerShell):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Then **close VS Code completely and reopen it**, or `uv` will not be on your
PATH yet.

You do **not** need to install Python yourself — uv downloads the version
pinned in `backend/.python-version` (3.13).

### 2. Clone and identify yourself

```powershell
git clone https://github.com/patronfyp/patron.git
cd patron
git checkout develop
git config --local user.name "Your Name"
git config --local user.email "your-github-email@example.com"
```

Setting `user.name` / `user.email` is not optional — without it your commits are
attributed to the wrong identity and you get no credit on the contributor graph.

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:5173>.

### 4. Backend

```powershell
cd ..\backend
uv sync
Copy-Item .env.example .env
```

Now generate a real secret and put it in `.env`:

```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Paste the output as the value of `SECRET_KEY` in `backend/.env`.

> The app **will not start** without it. `SECRET_KEY` has no default on
> purpose — a well-known signing key must never be able to reach production by
> accident.

Then run:

```powershell
uv run uvicorn main:app --reload
```

| URL | What it is |
|---|---|
| <http://localhost:8000/health> | liveness check → `{"status":"ok"}` |
| <http://localhost:8000/docs> | auto-generated interactive API docs (Swagger UI) |

### 5. Recommended VS Code extensions

```powershell
code --install-extension EditorConfig.EditorConfig
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-python.python
code --install-extension charliermarsh.ruff
```

EditorConfig is the important one — without it VS Code ignores
`.editorconfig`, and everyone's indentation and line endings drift apart.

---

## Everyday commands

**Frontend** — run inside `frontend/`:

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | production build |
| `npm run lint` | find problems |
| `npm run lint:fix` | fix what can be fixed automatically |
| `npm run format` | format all files |
| `npm test` | tests, watch mode |
| `npm run test:run` | tests once |

**Backend** — run inside `backend/`:

| Command | What it does |
|---|---|
| `uv run uvicorn main:app --reload` | dev server with hot reload |
| `uv run ruff check .` | find problems |
| `uv run ruff check . --fix` | fix what can be fixed automatically |
| `uv run ruff format .` | format all files |
| `uv run pytest` | tests |
| `uv add <package>` | add a dependency |
| `uv add --dev <package>` | add a dev-only dependency |
| `uv sync` | install exactly what the lockfile says |

Never run `pip install` here. It bypasses `uv.lock` and your environment will
silently drift from everyone else's.

---

## Environment files

| File | Committed? | Purpose |
|---|---|---|
| `frontend/.env.example` | yes | template |
| `frontend/.env.local` | **no** | your local values |
| `backend/.env.example` | yes | template |
| `backend/.env` | **no** | your local values, including `SECRET_KEY` |

Rule: templates are committed, real values never are. If you add a new setting,
add it to the `.env.example` too — otherwise the next person's app breaks with
no explanation.

> Every `VITE_*` variable is bundled into the browser build and is publicly
> readable. Secrets belong in `backend/.env` only.

---

## Branching and workflow

```
feature/<name>  →  PR  →  develop  →  PR  →  main
```

| Branch | Rule |
|---|---|
| `main` | always demo-able. Direct push blocked. PR + 1 approval, squash only, linear history. |
| `develop` | integration branch. All feature work merges here. |
| `feature/*` | your working branch. Push freely. |

Day-to-day:

```powershell
git checkout develop
git pull
git checkout -b feature/job-listing
# ...work, commit...
git push -u origin feature/job-listing
# open a PR on GitHub with base = develop
```

**Direct pushes to `main` and `develop` are not allowed** — for everyone,
including the repository owner. Every change arrives through a pull request and
is reviewed by another team member.

### Commit messages — Conventional Commits

```
<type>(<scope>): <short description in the imperative>
```

| Type | Use for |
|---|---|
| `feat` | a new feature |
| `fix` | a bug fix |
| `chore` | config, tooling, dependencies |
| `docs` | documentation |
| `refactor` | restructuring with no behaviour change |
| `test` | tests |
| `style` | formatting only |

Examples:

```
feat(jobs): add job detail page with context-aware CTAs
fix(auth): refresh token before it expires instead of after
chore(backend): scaffold FastAPI app with uv, ruff and pytest
docs: add local setup steps to README
```

Merges into `develop` and `main` use **Squash and merge**, so a feature branch
becomes a single readable commit.

---

## Team

| Member | Focus |
|---|---|
| Abdul Rafay | project lead, architecture, frontend + backend |
| Umair Rizwan | documentation, SRS, API docs |
| Rohan Zubair | development |

---

## Project status

| Area | State |
|---|---|
| Repo, branching, branch rules | done |
| Frontend scaffold + tooling | done |
| Backend scaffold + tooling | done |
| Frontend ↔ backend integration | not started |
| PostgreSQL + migrations | not started |
| Feature modules | not started |

Phase 1 (MVP) scope is Modules 1–8 and 11 from the feature specification.
Modules 5, 6 and 7 — Recommendation, Employee Referral, Alumni Referral — are
the product's core differentiator and cannot be cut.

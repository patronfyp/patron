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
│   ├── main.py       app, CORS, /health
│   ├── config.py     settings loaded from .env
│   ├── db.py         engine, session factory, ORM Base
│   └── migrations/   Alembic migration scripts
├── .editorconfig
├── .gitignore
└── README.md
```

Folders are added when a feature needs them, not upfront.

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
| Database | PostgreSQL 18 | |
| ORM | SQLAlchemy 2.0 (async) + asyncpg | typed models instead of hand-written SQL |
| Migrations | Alembic | schema changes become committed files, so every machine and production stay in sync |

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
| PostgreSQL 18 | <https://www.postgresql.org/download/windows/> | `psql --version` |

#### Installing uv

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

You do **not** need to install Python yourself — uv downloads the version
pinned in `backend/.python-version` (3.13).

#### Installing PostgreSQL

In the installer:

- keep both **PostgreSQL Server** and **Command Line Tools** ticked
- **write down the password** you set for the `postgres` user — it is not
  shown again, and you need it for `DATABASE_URL`
- leave the port at `5432`
- click **Cancel** if Stack Builder opens at the end; it is not needed

The installer does **not** put `psql` on your PATH. Add it yourself:

```powershell
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path","User")
[Environment]::SetEnvironmentVariable("Path", $userPath.TrimEnd(';') + ";" + $pgBin, "User")
```

Adjust `18` if you installed a different major version — check which folders
exist under `C:\Program Files\PostgreSQL\`.

#### Then restart VS Code

After installing uv and PostgreSQL, **close VS Code completely and reopen it** —
not just the terminal. A PATH change only reaches newly started processes, and
VS Code copies its environment once at launch, so a new terminal inside the old
window still sees the old PATH.

Verify all four:

```powershell
git --version
node -v
uv --version
psql --version
```

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

### 4. Database

Create the database (it will ask for the `postgres` password you set during
installation):

```powershell
psql -U postgres -c "CREATE DATABASE patron;"
```

Verify it exists:

```powershell
psql -U postgres -l
```

`patron` should appear in the list.

> If you forgot the password, reset it — this asks for the old one, so if that
> is also gone you will need to reinstall PostgreSQL:
> ```powershell
> psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'NewPassword123';"
> ```

### 5. Backend

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

Then set `DATABASE_URL` in the same file, using the `postgres` password from the
installation step:

```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/patron
```

> `SECRET_KEY` and `DATABASE_URL` have **no defaults** on purpose — the app
> refuses to start without them, rather than silently signing tokens with a
> well-known key or pointing at the wrong database.
>
> Note the `+asyncpg` in the URL. GUI tools like Navicat and pgAdmin give you a
> plain `postgresql://` string; SQLAlchemy needs the async driver named
> explicitly, so you always add that part by hand.
>
> If your password contains `@ : / #`, URL-encode it (`@` → `%40`).

Apply any pending database migrations:

```powershell
uv run alembic upgrade head
```

Then run the server:

```powershell
uv run uvicorn main:app --reload
```

| URL | What it is |
|---|---|
| <http://localhost:8000/health> | liveness check → `{"status":"ok","env":"development","database":"ok"}` |
| <http://localhost:8000/docs> | auto-generated interactive API docs (Swagger UI) |

If `"database"` says `unreachable`, the API is up but Postgres is not — check
that the `postgresql-x64-18` service is running and that `DATABASE_URL` is
correct.

### 6. Recommended VS Code extensions

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

**Database migrations** — run inside `backend/`:

| Command | What it does |
|---|---|
| `uv run alembic upgrade head` | apply all pending migrations |
| `uv run alembic revision --autogenerate -m "add jobs table"` | generate a migration from your model changes |
| `uv run alembic current` | which revision this database is on |
| `uv run alembic history` | list all migrations |
| `uv run alembic downgrade -1` | undo the last migration |

Rules:

1. **Never create or alter a table by hand** — not in Navicat, not in pgAdmin,
   not with raw SQL. A change made that way exists only on your machine, and
   nobody else's database (or production) will have it. Change the model, then
   generate a migration.
2. **Always read the generated migration before applying it.** Autogenerate is
   good, not perfect — it misses renames, and it will happily write a column
   drop you did not intend.
3. **Commit the migration file** along with the model change, in the same PR.
4. After pulling, run `uv run alembic upgrade head` — the same habit as running
   `npm install` / `uv sync` after a dependency change.

Use Navicat, pgAdmin or DBeaver freely for *reading* data. Just never let them
change the schema.

---

## Environment files

| File | Committed? | Purpose |
|---|---|---|
| `frontend/.env.example` | yes | template |
| `frontend/.env.local` | **no** | your local values |
| `backend/.env.example` | yes | template |
| `backend/.env` | **no** | your local values, including `SECRET_KEY` and `DATABASE_URL` |

Rule: templates are committed, real values never are. If you add a new setting,
add it to the `.env.example` too — otherwise the next person's app breaks with
no explanation.

### After every `git pull` — check your `.env`

`git pull` updates `.env.example`. It does **not** touch your `.env`, because
that file is yours and is not tracked. So a setting someone else added is
missing on your machine until you add it by hand.

Symptom — the app or Alembic crashes on startup with a Pydantic error like:

```
pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings
database_url
  Field required [type=missing, ...]
```

`Field required [type=missing]` means the setting is absent from your `.env`.
It is **not** a wrong password — a bad password fails later, with
`password authentication failed`.

Compare the two files and copy across anything missing:

```powershell
cd backend
Compare-Object (Get-Content .env.example) (Get-Content .env)
```

Lines marked `<=` exist in `.env.example` but not in your `.env`. Add them with
your own values, then save. Same command works in `frontend/` with
`.env.example` and `.env.local`.

Make this a habit alongside the other post-pull steps:

```powershell
git pull
npm install                        # in frontend/ - if package.json changed
uv sync                            # in backend/  - if pyproject.toml changed
uv run alembic upgrade head        # in backend/  - if migrations were added
# and check .env against .env.example
```

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
| Frontend ↔ backend integration | done |
| PostgreSQL + SQLAlchemy + Alembic | done — configured, no models yet |
| Feature modules | not started |

Phase 1 (MVP) scope is Modules 1–8 and 11 from the feature specification.
Modules 5, 6 and 7 — Recommendation, Employee Referral, Alumni Referral — are
the product's core differentiator and cannot be cut.

# Engineering Standards

The rules we all follow on Patron. Written for a team that is new to this — so
every rule comes with an example and the reason behind it. A rule you don't
understand is a rule you will break.

**Related documents**

| Document | What it covers |
|---|---|
| [README.md](../README.md) | how to install and run the project |
| [GIT_WORKFLOW.md](GIT_WORKFLOW.md) | branching, commits, pull requests, reviews |
| this file | how to structure and write the code |

---

## How to use this document

- Read sections 1–5 once before you write your first feature.
- Keep section 11 (Definition of Done) and 12 (Review checklist) open while you
  work — they are checklists, not reading material.
- If a rule blocks you or looks wrong, **change the rule** through a PR. Do not
  quietly ignore it. A standard nobody follows is worse than no standard.
- Where this document and the existing code disagree, the document wins — and
  the code is a bug to fix.

### A note on the current state of the repo

The backend is currently flat: `main.py`, `config.py`, `db.py`. That is
deliberate — we agreed to add folders when a feature actually needs them, not
upfront. Section 2 describes the structure we grow **into**. The first person to
build a real module creates its folder, following section 2 exactly.

---

## 1. Principles

Five ideas that every specific rule below comes from.

| # | Principle | In practice |
|---|---|---|
| 1 | **One job per file** | a file that does routing, validation, business rules and SQL is four files pretending to be one |
| 2 | **Dependencies point one way** | features may use shared code; shared code never reaches back into features |
| 3 | **Boring and obvious beats clever** | the next person reading it will be a tired teammate at 2am, possibly you |
| 4 | **Fail loudly, early** | a missing config should crash at startup, not corrupt data at 3pm |
| 5 | **Never trust input** | validate everything crossing a boundary: HTTP requests, form fields, URL params |

---

## 2. Architecture

### 2.1 The three layers

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   FRONTEND   │  HTTP  │   BACKEND    │  SQL   │   DATABASE   │
│  React/Vite  │ ─────► │   FastAPI    │ ─────► │  PostgreSQL  │
│    :5173     │ ◄───── │    :8000     │ ◄───── │    :5432     │
└──────────────┘        └──────────────┘        └──────────────┘
   what the user          the rules and           the durable
      sees                  decisions                truth
```

**Rule:** the frontend never talks to the database. Ever. All data goes through
the backend, because that is the only place we can enforce "is this person
allowed to see this?".

### 2.2 Backend structure

```
backend/
├── main.py                    creates the app, mounts routers. No business logic.
├── config.py                  Settings from .env. The only place env vars are read.
├── db.py                      engine, session factory, Base, get_session
├── app/
│   ├── core/                  cross-cutting concerns
│   │   ├── security.py        password hashing, JWT encode/decode
│   │   ├── exceptions.py      our exception classes + handlers
│   │   └── logging.py         log configuration
│   ├── api/
│   │   ├── deps.py            shared dependencies (get_current_user, ...)
│   │   └── v1/
│   │       ├── router.py      collects every v1 router
│   │       └── routes/        endpoints that don't belong to one module
│   └── modules/               one package per domain
│       ├── auth/
│       ├── profiles/
│       ├── cv/
│       ├── connections/
│       ├── jobs/
│       ├── recommendations/
│       ├── referrals/
│       ├── alumni/
│       ├── companies/
│       └── notifications/
├── migrations/                Alembic
└── tests/
```

### 2.3 Anatomy of a backend module

Every module has the same five files. Always these names — so anyone can find
anything in any module without looking.

```
app/modules/jobs/
├── __init__.py
├── models.py        SQLAlchemy tables
├── schemas.py       Pydantic request/response shapes
├── repository.py    database queries. The only place SQL lives.
├── service.py       business rules and decisions
└── router.py        HTTP endpoints
```

**Data flows one direction only:**

```
HTTP request
    │
    ▼
router.py        "URL matched. Is the body valid? Who is calling?"
    │
    ▼
service.py       "Is this allowed? What are the rules? Orchestrate the work."
    │
    ▼
repository.py    "Fetch / insert / update rows."
    │
    ▼
models.py        the table
```

Never upward. `repository.py` does not call `service.py`. `router.py` does not
touch the database.

#### What belongs in each file

| File | Does | Must not |
|---|---|---|
| `router.py` | declare the URL, method, response model; call one service function; return | contain `if` statements about business rules, or any query |
| `service.py` | enforce rules, coordinate multiple repositories, raise domain errors | build SQL, or know about HTTP status codes |
| `repository.py` | build and run queries; return models or `None` | make decisions about whether something is allowed |
| `schemas.py` | define and validate the shapes crossing HTTP | contain logic beyond validation |
| `models.py` | define tables, columns, relationships | contain queries |

#### Why bother — the honest reason

You could put everything in `router.py`. It would work. Here is what you lose:

| Problem | With layers | Without |
|---|---|---|
| Test "can an employee refer a candidate?" | call one function | spin up an HTTP client, build a fake request, mock auth |
| Same rule needed in two endpoints | call the service from both | copy-paste, then fix the bug twice |
| Swap Postgres for something else | rewrite `repository.py` | rewrite everything |
| Three people editing one module | three different files, no conflict | one 900-line file, conflicts every day |

That last row is the one that will bite this team first.

### 2.4 Frontend structure

```
frontend/src/
├── main.jsx                   entry: providers only
├── app/
│   ├── App.jsx                the shell
│   ├── providers/             QueryProvider, ThemeProvider, AuthProvider
│   ├── router/                routes, ProtectedRoute, RoleRoute
│   └── layouts/               AuthLayout, AppLayout, DashboardLayout
├── features/                  one folder per domain — mirrors backend modules
│   ├── auth/
│   ├── profile/
│   ├── cv-builder/
│   ├── connections/
│   ├── jobs/
│   ├── recommendations/
│   ├── referrals/
│   ├── alumni/
│   ├── company/
│   └── notifications/
├── shared/                    reusable, feature-agnostic
│   ├── api/                   axios client + interceptors
│   ├── components/
│   │   ├── ui/                thin wrappers over antd
│   │   ├── feedback/          Loader, ErrorState, EmptyState
│   │   └── layout/            Page, Section, Toolbar
│   ├── hooks/
│   ├── lib/                   formatters, validators, date helpers
│   ├── constants/
│   └── types/                 JSDoc typedefs
├── config/                    env.js — the only place import.meta.env is read
└── styles/                    theme tokens, global.css
```

> `src/lib/api.js` exists today from the health-check work. Move it to
> `src/shared/api/` when `shared/` is created.

### 2.5 Anatomy of a frontend feature

```
features/jobs/
├── api/
│   └── jobs.api.js       raw HTTP calls. No React.
├── hooks/
│   └── useJobs.js        React Query hooks wrapping the api layer
├── components/
│   ├── JobCard.jsx       pieces used only inside this feature
│   └── JobFilters.jsx
├── pages/
│   ├── JobListPage.jsx   route targets. Compose, don't compute.
│   └── JobDetailPage.jsx
├── store/                (optional) feature-local zustand slice
└── index.js              the feature's PUBLIC API
```

`index.js` is a barrel — it re-exports only what other features are allowed to
use:

```js
// features/jobs/index.js
export { JobCard } from './components/JobCard'
export { useJobs, useJob } from './hooks/useJobs'
```

### 2.6 Dependency rules

```
        app/  ──────►  features/  ──────►  shared/
         │                                   ▲
         └───────────────────────────────────┘

   arrows = "is allowed to import from"
```

| Rule | ✅ Allowed | ❌ Not allowed |
|---|---|---|
| Cross-feature imports go through the barrel | `import { JobCard } from '@/features/jobs'` | `import JobCard from '@/features/jobs/components/JobCard'` |
| Inside the same feature, use relative paths | `import { JobCard } from '../components/JobCard'` | `import { JobCard } from '@/features/jobs'` (circular) |
| `shared/` is independent | `shared/lib/formatDate.js` imports nothing from features | `shared/components/JobBadge.jsx` importing from `features/jobs` |
| `app/` wires things together | `app/router` imports pages from features | a feature importing from `app/` |

The first and third rules are enforced by ESLint. When you add `features/` and
`shared/`, restore these to `frontend/eslint.config.js`:

```js
'no-restricted-imports': ['error', {
  patterns: [{
    group: ['@/features/*/*'],
    message: "Import from '@/features/<name>' (its index.js), not its internals.",
  }],
}],
'import/no-restricted-paths': ['error', {
  zones: [
    { target: './src/shared', from: './src/features',
      message: 'shared/ must not depend on features/.' },
    { target: './src/shared', from: './src/app',
      message: 'shared/ must not depend on app/.' },
    { target: './src/features', from: './src/app',
      message: 'features/ must not depend on app/.' },
  ],
}],
```

**When does something move to `shared/`?** When a *second* feature needs it. Not
before — premature sharing produces a `shared/` folder full of things with one
caller and three configuration flags.

### 2.7 The mirror

Frontend features and backend modules use the same names.

| Domain | Frontend | Backend |
|---|---|---|
| Authentication | `features/auth/` | `modules/auth/` |
| Jobs | `features/jobs/` | `modules/jobs/` |
| Referrals | `features/referrals/` | `modules/referrals/` |
| Alumni | `features/alumni/` | `modules/alumni/` |

A new person should be able to guess where anything lives from either side.

---

## 3. Backend standards

### 3.1 Layers, with real code

**`router.py` — thin**

```python
# app/modules/jobs/router.py
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from db import get_session

from . import service
from .schemas import JobCreate, JobRead

router = APIRouter(prefix="/jobs", tags=["jobs"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> JobRead:
    """Post a new job. Only a verified company member may do this."""
    job = await service.create_job(session, payload, posted_by=current_user)
    return JobRead.model_validate(job)
```

Notice what is **not** there: no `if`, no query, no permission check. Those live
in the service.

**`service.py` — the rules**

```python
# app/modules/jobs/service.py
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError

from . import repository
from .models import Job
from .schemas import JobCreate


async def create_job(session: AsyncSession, payload: JobCreate, posted_by) -> Job:
    """Create a job posting.

    A company must be verified before it can post - see Module 14.4.
    """
    company = await repository.get_company(session, payload.company_id)
    if company is None:
        raise NotFoundError("Company not found")
    if not company.is_verified:
        raise ForbiddenError("Company must be verified before posting jobs")
    if posted_by.company_id != company.id:
        raise ForbiddenError("You can only post jobs for your own company")

    return await repository.create_job(session, payload, posted_by.id)
```

**`repository.py` — queries only**

```python
# app/modules/jobs/repository.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Job
from .schemas import JobCreate


async def get_by_id(session: AsyncSession, job_id: int) -> Job | None:
    return await session.get(Job, job_id)


async def list_open(session: AsyncSession, *, limit: int, offset: int) -> list[Job]:
    stmt = (
        select(Job)
        .where(Job.is_open.is_(True))
        .order_by(Job.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.scalars(stmt)
    return list(result)


async def create_job(session: AsyncSession, payload: JobCreate, user_id: int) -> Job:
    job = Job(**payload.model_dump(), posted_by_id=user_id)
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job
```

### 3.2 Async rules

The whole backend is async. One blocking call freezes the entire server for
every user, not just the caller.

| ✅ Use | ❌ Never use |
|---|---|
| `await session.execute(...)` | `session.execute(...)` without await |
| `httpx.AsyncClient` | `requests` |
| `await asyncio.sleep(n)` | `time.sleep(n)` |
| `aiofiles` for file I/O | plain `open()` on large files in a request |

If you must call something blocking (a library with no async version):

```python
from starlette.concurrency import run_in_threadpool

result = await run_in_threadpool(blocking_function, arg)
```

Every route handler is `async def`. Every repository and service function that
touches the database is `async def`.

### 3.3 API design

#### URLs

```
/api/v1/<resource>              collection
/api/v1/<resource>/{id}         one item
/api/v1/<resource>/{id}/<sub>   nested collection
```

| Rule | ✅ | ❌ |
|---|---|---|
| Plural nouns for collections | `/api/v1/jobs` | `/api/v1/job`, `/api/v1/getJobs` |
| Lower-case, hyphens if needed | `/api/v1/alumni-referrals` | `/api/v1/AlumniReferrals` |
| Verbs live in the HTTP method | `DELETE /api/v1/jobs/5` | `POST /api/v1/jobs/5/delete` |
| Version everything | `/api/v1/jobs` | `/jobs` |

`/health` is the one exception — unversioned, because deployment tooling checks
it and it has nothing to do with the API contract.

Actions that are genuinely not CRUD get a sub-resource:

```
POST /api/v1/referrals/{id}/consent
POST /api/v1/referrals/{id}/withdraw
```

#### Status codes

| Code | Use for |
|---|---|
| `200 OK` | successful GET, PATCH, or an action that returns data |
| `201 Created` | POST that created something |
| `204 No Content` | successful DELETE |
| `400 Bad Request` | malformed request we rejected ourselves |
| `401 Unauthorized` | not logged in, or token invalid/expired |
| `403 Forbidden` | logged in, but not allowed |
| `404 Not Found` | does not exist — or exists but you may not know that |
| `409 Conflict` | duplicate, or state conflict (e.g. already referred for this job) |
| `422 Unprocessable Entity` | validation failed (FastAPI returns this automatically) |
| `500 Internal Server Error` | our bug. Never return this on purpose. |

401 vs 403 is the one people get wrong: **401 = who are you? 403 = I know who
you are, and no.**

#### Error responses — one shape everywhere

```json
{
  "detail": "Company must be verified before posting jobs",
  "code": "company_not_verified"
}
```

`detail` is safe to show a user. `code` is what the frontend switches on — never
match on the message text, because messages get reworded.

Define exceptions once in `app/core/exceptions.py` and register handlers in
`main.py`, so no route ever builds an error response by hand.

**Never leak internals** in `detail`: no stack traces, no SQL, no file paths, no
"user with email x@y.com not found" (that confirms an account exists to an
attacker).

#### Pagination

Every list endpoint is paginated from day one. Retrofitting it later means
changing every caller.

```
GET /api/v1/jobs?limit=20&offset=0
```

```json
{
  "items": [ ... ],
  "total": 137,
  "limit": 20,
  "offset": 0
}
```

Default `limit` 20, maximum 100. Enforce the maximum in the schema — a client
asking for `limit=1000000` should get a 422, not a dead database.

### 3.4 Schemas (Pydantic)

One schema per purpose. Do not reuse an input schema as an output schema.

```python
# app/modules/jobs/schemas.py
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class JobBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20)
    location: str = Field(max_length=120)
    is_remote: bool = False


class JobCreate(JobBase):
    """What a client may send when creating a job."""
    company_id: int


class JobUpdate(BaseModel):
    """Every field optional - this is a PATCH."""
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=20)
    is_open: bool | None = None


class JobRead(JobBase):
    """What we send back. Note: no internal fields."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_open: bool
    created_at: datetime
```

| Rule | Why |
|---|---|
| Separate `Create`, `Update`, `Read` | a client must not be able to set `id`, `created_at`, or `is_verified` |
| `Update` has all-optional fields | PATCH means partial |
| `Read` needs `from_attributes=True` | so it can be built from an ORM object |
| Put constraints in `Field(...)` | validation happens before your code runs |
| Never return a model directly | you will leak `password_hash` the day someone adds it |

That last one is not hypothetical. Returning ORM objects is the single most
common way projects leak password hashes and internal flags.

### 3.5 Database and models

```python
# app/modules/jobs/models.py
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str]
    location: Mapped[str] = mapped_column(String(120))
    is_remote: Mapped[bool] = mapped_column(default=False)
    is_open: Mapped[bool] = mapped_column(default=True, index=True)

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    company: Mapped["Company"] = relationship(back_populates="jobs")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

#### Naming

| Thing | Convention | Example |
|---|---|---|
| Table | plural, `snake_case` | `jobs`, `alumni_referrals` |
| Column | singular, `snake_case` | `title`, `created_at` |
| Foreign key | `<singular_table>_id` | `company_id`, `posted_by_id` |
| Boolean | `is_` / `has_` prefix | `is_open`, `has_consented` |
| Timestamp | `_at` suffix | `created_at`, `verified_at` |
| Join table | both tables, alphabetical | `job_skills` |

#### Rules

| # | Rule | Why |
|---|---|---|
| 1 | Every table has `id`, `created_at`, `updated_at` | you will always want to know when a row appeared |
| 2 | Index every foreign key and every column you filter on | a missing index is invisible until the table has 50,000 rows |
| 3 | Set `ondelete` explicitly on foreign keys | otherwise deleting a company leaves orphan jobs |
| 4 | Money as `Numeric(12, 2)`, never `Float` | floats lose cents |
| 5 | Timestamps in UTC | timezones are a whole separate bug category |
| 6 | Prefer `is_deleted` over real deletes for user data | referrals and recommendations are an audit trail |
| 7 | Enums: `Mapped[str]` + a `StrEnum` in Python | DB enums are painful to migrate |
| 8 | `String(n)` with a real length for short text | unbounded text where a name belongs invites abuse |

### 3.6 Migrations

**Never change the database by hand.** Not in Navicat, not in pgAdmin, not with
raw SQL. A hand-made change exists only on your machine; nobody else's database
and no deployment will ever have it.

```powershell
# 1. edit models.py
# 2. generate
uv run alembic revision --autogenerate -m "add jobs table"
# 3. READ the generated file in migrations/versions/
# 4. apply
uv run alembic upgrade head
# 5. commit the migration WITH the model change, same PR
```

| Rule | Why |
|---|---|
| Always read the generated migration | autogenerate misses renames — it writes a drop + an add, which deletes data |
| One migration per PR | easier to reverse |
| Never edit a migration that is already merged | others have run it; write a new one |
| Import new model modules in `migrations/env.py` | Alembic only sees models that are imported |
| Migrations must be reversible | fill in `downgrade()`, don't leave it `pass` |

New models must be imported somewhere that `migrations/env.py` reaches, or
autogenerate will silently produce an empty migration and you will spend an hour
wondering why.

### 3.7 Error handling

```python
# app/core/exceptions.py
class AppError(Exception):
    """Base for all errors we raise deliberately."""
    status_code = 500
    code = "internal_error"

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
```

Services raise these. A single handler in `main.py` turns them into responses.
Routes stay clean.

| ✅ | ❌ |
|---|---|
| `raise ForbiddenError("Company must be verified")` | `return {"error": "not allowed"}` |
| let unexpected exceptions bubble to the handler | `except Exception: pass` |
| catch the specific exception you can handle | catch everything and continue |

Swallowing exceptions is how a bug becomes a mystery. If you cannot handle it,
let it propagate.

---

## 4. Frontend standards

### 4.1 Pages compose, components render, hooks decide

```jsx
// features/jobs/pages/JobListPage.jsx
import { Flex } from 'antd'

import { ErrorState, Loader } from '@/shared/components/feedback'

import { JobCard } from '../components/JobCard'
import { JobFilters } from '../components/JobFilters'
import { useJobs } from '../hooks/useJobs'

export function JobListPage() {
  const { data, isPending, isError, error, refetch } = useJobs()

  if (isPending) return <Loader label="Loading jobs" />
  if (isError) return <ErrorState error={error} onRetry={refetch} />
  if (!data.items.length) return <EmptyState message="No jobs yet" />

  return (
    <Flex vertical gap={16}>
      <JobFilters />
      {data.items.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </Flex>
  )
}
```

The page has no `fetch`, no `useEffect`, no filtering logic. It picks which
thing to show. That is all a page does.

| Layer | Job |
|---|---|
| `api/*.api.js` | make the HTTP call, return `response.data`. No React. |
| `hooks/use*.js` | React Query wrapper. Cache keys, invalidation. |
| `components/*` | render props into UI. Ideally no data fetching. |
| `pages/*` | pick a state, compose components |

### 4.2 The API layer

```js
// features/jobs/api/jobs.api.js
import { api } from '@/shared/api/client'

export const jobsApi = {
  list: async ({ limit = 20, offset = 0 } = {}) => {
    const { data } = await api.get('/api/v1/jobs', { params: { limit, offset } })
    return data
  },

  getById: async (id) => {
    const { data } = await api.get(`/api/v1/jobs/${id}`)
    return data
  },

  create: async (payload) => {
    const { data } = await api.post('/api/v1/jobs', payload)
    return data
  },
}
```

| Rule | Why |
|---|---|
| Always use the shared `api` client | one place for base URL, auth header, refresh, timeout |
| Never call `axios` directly in a component | you lose all of the above |
| No React in this file | it stays testable and reusable |
| Return `data`, not the response | callers should not care that we use axios |

### 4.3 React Query hooks

```js
// features/jobs/hooks/useJobs.js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { jobsApi } from '../api/jobs.api'

export const jobKeys = {
  all: ['jobs'],
  list: (filters) => ['jobs', 'list', filters],
  detail: (id) => ['jobs', 'detail', id],
}

export function useJobs(filters = {}) {
  return useQuery({
    queryKey: jobKeys.list(filters),
    queryFn: () => jobsApi.list(filters),
  })
}

export function useJob(id) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => jobsApi.getById(id),
    enabled: Boolean(id),
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: jobsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  })
}
```

| Rule | Why |
|---|---|
| Export a `keys` object per feature | typo'd inline keys silently break caching |
| `enabled: Boolean(id)` when the id may be undefined | stops a request firing with `undefined` in the URL |
| Invalidate after a mutation | otherwise the list still shows stale data |
| `useQuery` for reads, `useMutation` for writes | different semantics, different cache behaviour |

### 4.4 State: which tool

The single most common architectural mistake in a project this size is putting
server data in a global store. Use this table.

| The data | Tool | Example |
|---|---|---|
| Came from the backend | **React Query** | jobs list, profile, notifications |
| UI-only, one component | **`useState`** | is this dropdown open |
| UI-only, whole app | **zustand** | dark mode, sidebar collapsed, current user |
| Derivable from other state | **nothing** — compute it | `fullName = first + ' ' + last` |
| In the URL | **`useSearchParams`** | filters, page number, search query |

```js
// features/auth/store/authStore.js
import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ user, accessToken }),
  clearSession: () => set({ user: null, accessToken: null }),
}))
```

Keep stores tiny. If a store is growing arrays of records fetched from the API,
that data belongs in React Query.

**Filters belong in the URL.** `?location=lahore&remote=true` means a filtered
search can be shared, bookmarked and survives a refresh — for free.

### 4.5 Components

| Rule | ✅ | ❌ |
|---|---|---|
| One component per file, named after the file | `JobCard.jsx` exports `JobCard` | three components in `stuff.jsx` |
| Named exports | `export function JobCard()` | `export default function()` |
| Destructure props in the signature | `function JobCard({ job, onSave })` | `function JobCard(props)` then `props.job` everywhere |
| Under ~150 lines | split into smaller components | a 600-line component |
| Document props with JSDoc | see below | guess what `data` is |

Because we are on JavaScript rather than TypeScript, JSDoc is how a reader knows
what a prop is. This is not optional:

```jsx
/**
 * A single job in the listing feed.
 *
 * @param {object} props
 * @param {import('@/shared/types').Job} props.job
 * @param {(jobId: number) => void} [props.onSave] - omit to hide the save button
 */
export function JobCard({ job, onSave }) {
  // ...
}
```

Define the shared shapes once in `shared/types/`:

```js
// shared/types/job.js
/**
 * @typedef {object} Job
 * @property {number} id
 * @property {string} title
 * @property {string} location
 * @property {boolean} isRemote
 * @property {boolean} isOpen
 * @property {string} createdAt - ISO 8601
 */
export {}
```

### 4.6 Every screen handles four states

A screen that only handles the happy path is not finished.

| State | Show |
|---|---|
| **Loading** | skeleton or `<Loader />` — never a blank screen |
| **Error** | what went wrong, in human words, plus a Retry button |
| **Empty** | "No jobs yet" plus, if useful, an action to create one |
| **Success** | the data |

Build these three once in `shared/components/feedback/` and reuse them
everywhere, so they look and behave the same.

Error messages people can act on:

| ❌ | ✅ |
|---|---|
| "Error" | "Could not load jobs. Check your connection and try again." |
| "Request failed with status code 403" | "You need a verified company account to post jobs." |
| `[object Object]` | anything at all |

### 4.7 Forms

Use antd's `Form` — it gives validation, error display and accessible labels.

```jsx
import { App, Button, Form, Input } from 'antd'

import { useCreateJob } from '../hooks/useJobs'

export function JobForm() {
  const { message } = App.useApp()
  const { mutate, isPending } = useCreateJob()

  const onFinish = (values) => {
    mutate(values, {
      onSuccess: () => message.success('Job posted'),
      onError: (error) =>
        message.error(error.response?.data?.detail ?? 'Could not post the job'),
    })
  }

  return (
    <Form layout="vertical" onFinish={onFinish} disabled={isPending}>
      <Form.Item
        name="title"
        label="Job title"
        rules={[
          { required: true, message: 'Job title is required' },
          { min: 3, message: 'At least 3 characters' },
        ]}
      >
        <Input placeholder="e.g. Backend Engineer" />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={isPending}>
        Post job
      </Button>
    </Form>
  )
}
```

| Rule | Why |
|---|---|
| Every field has a `label` | placeholders vanish when typing, and screen readers need labels |
| Validation rules carry messages | "Invalid" tells the user nothing |
| Disable the form while submitting | stops double submission |
| Show the backend's `detail` on error | the server knows why it refused |
| Mirror backend validation, don't replace it | client validation is UX; the server is the authority |

### 4.8 antd usage

| Rule | Why |
|---|---|
| Use antd components before writing your own | accessibility and keyboard handling are already done |
| Theme via `ConfigProvider` tokens, not per-component overrides | one place to change, and dark mode comes free |
| No inline `style` for anything reusable | use antd props (`gap`, `vertical`) or a CSS module |
| Do **not** add Tailwind or another UI library | two systems fighting over the same elements |
| Use `App.useApp()` for `message` / `notification` / `modal` | the static `message.x()` imports ignore your theme |
| `Flex` and `Space` instead of hand-rolled flexbox | consistent spacing across the app |

### 4.9 Frontend naming

| Thing | Convention | Example |
|---|---|---|
| Component file | `PascalCase.jsx` | `JobCard.jsx` |
| Hook file | `camelCase.js`, `use` prefix | `useJobs.js` |
| API file | `<domain>.api.js` | `jobs.api.js` |
| Store file | `<domain>Store.js` | `authStore.js` |
| Folder | `kebab-case` | `cv-builder/` |
| Boolean prop/variable | `is` / `has` / `should` prefix | `isOpen`, `hasConsented` |
| Event handler prop | `on` prefix | `onSave`, `onSelect` |
| Handler implementation | `handle` prefix | `handleSave` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_UPLOAD_MB` |

---

## 5. Shared conventions

### 5.1 Casing at a glance

| Context | Casing | Example |
|---|---|---|
| Python file, function, variable | `snake_case` | `create_job`, `job_id` |
| Python class | `PascalCase` | `JobCreate`, `AlumniReferral` |
| Python constant | `SCREAMING_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| JS function, variable | `camelCase` | `createJob`, `jobId` |
| React component | `PascalCase` | `JobCard` |
| Database table, column | `snake_case` | `alumni_referrals`, `created_at` |
| API path | `lower-kebab-case` | `/api/v1/alumni-referrals` |
| JSON field | `snake_case` | `{"created_at": "..."}` |
| Env variable | `SCREAMING_SNAKE_CASE` | `DATABASE_URL` |
| Git branch | `type/kebab-case` | `feature/job-detail-page` |

> **On JSON casing:** we keep `snake_case` over the wire, matching Python and the
> database, so a field has one name everywhere. It costs a little
> JavaScript-idiom purity and saves a whole class of "is it `createdAt` or
> `created_at` here?" bugs. Do not convert casing in the API layer.

### 5.2 Naming things well

| ❌ | ✅ | Why |
|---|---|---|
| `d`, `tmp`, `data2` | `daysUntilExpiry`, `draftCv` | you will not remember tomorrow |
| `getUser()` that also updates | `fetchUser()` / `updateUser()` | a name that lies is worse than no name |
| `flag`, `check` | `isVerified`, `hasPendingReferral` | say what it means |
| `handleClick` (in a 10-button page) | `handleWithdrawReferral` | which click? |
| `manager`, `helper`, `utils2` | name what it actually does | these words mean nothing |

Length should match scope: `i` in a three-line loop is fine; a module-level
variable called `i` is not.

### 5.3 Comments

Code says **what**. Comments say **why**.

```python
# ❌ says what the next line already says
# increment the counter
counter += 1

# ✅ says why, which the code cannot
# Referrals are tracked per (referrer, candidate, job) triple - see Module 6.11.
# A composite unique index enforces this, so we check first to return a clean
# 409 instead of surfacing an IntegrityError.
existing = await repository.find_referral(session, referrer_id, candidate_id, job_id)
```

Write a comment when:

- a decision is not obvious and the alternative looks reasonable
- you are working around a bug or a library quirk (link to the issue)
- a business rule comes from the spec (cite the module number)
- something looks wrong but is deliberate

Delete a comment when it describes the line beneath it. Never leave commented-out
code — git remembers it.

Docstrings on every public function, service and endpoint. FastAPI puts endpoint
docstrings straight into `/docs`, so they are user-facing documentation:

```python
async def create_referral(...):
    """Refer a candidate into a job at your own company.

    Requires verified employment at the hiring company. The candidate must
    consent before the referral reaches the company's pipeline (Module 6.5).
    """
```

### 5.4 Configuration

| Rule | Why |
|---|---|
| Every setting comes from `.env` | code that changes per environment is a bug |
| Backend reads env only in `config.py` | one source of truth; nothing else uses `os.environ` |
| Frontend reads env only in `config/env.js` | same |
| Required settings get **no default** | crash at startup, not silently in production |
| New setting → add to `.env.example` in the same PR | else everyone else's app breaks with no explanation |
| Secrets never in `VITE_*` | those are compiled into the browser bundle and are public |

---

## 6. Security

Non-negotiable, in a product handling identity and employment verification.

| # | Rule | Detail |
|---|---|---|
| 1 | Never commit secrets | `.env` is git-ignored. If one leaks: rotate it first, then clean history |
| 2 | Hash passwords, never encrypt or store them | `bcrypt` or `argon2` via `passlib` |
| 3 | Validate every input server-side | Pydantic schemas at the boundary. Client validation is UX only |
| 4 | Use the ORM / bound parameters | never f-string user input into SQL |
| 5 | Authorise on **every** endpoint | "is this person allowed?" — hiding a button is not security |
| 6 | Short-lived access tokens, long-lived refresh | ~15 min / ~7 days |
| 7 | Never return internal fields | separate `Read` schemas — never serialise a model directly |
| 8 | Explicit CORS origins | never `allow_origins=["*"]` with credentials |
| 9 | Rate-limit auth and endorsement endpoints | Modules 14.1–14.3 |
| 10 | Generic auth errors | "Invalid email or password" — never say which one was wrong |
| 11 | Validate uploads | type, size, and never trust the client-supplied filename |
| 12 | Log events, never secrets | no passwords, tokens or full request bodies in logs |

Two that are specific to Patron:

- **Verification is the product.** University and employer verification unlock
  Referral and Alumni Referral eligibility. Any endpoint that grants or reads
  verified status is security-critical — treat it like auth code.
- **Consent is mandatory.** A candidate must accept before a referral or
  recommendation reaches a company (Modules 5B.4, 6.5). This is enforced in the
  service layer, not the UI.

---

## 7. Accessibility

This product is meant to go international, and accessibility is a legal
requirement in many of those markets (WCAG 2.1 AA is the usual bar). Retrofitting
it across 15 modules is far more expensive than doing it as you go.

| # | Rule | How to check |
|---|---|---|
| 1 | Every input has a real `<label>` | antd `Form.Item label=` does this |
| 2 | Every image has `alt` (empty `alt=""` if decorative) | `eslint-plugin-jsx-a11y` catches it |
| 3 | Everything reachable by keyboard | put the mouse down and press Tab through the page |
| 4 | Visible focus indicator | do not remove `outline` without a replacement |
| 5 | Colour is never the only signal | add an icon or text next to a red/green state |
| 6 | Text contrast at least 4.5:1 | browser devtools reports it |
| 7 | Semantic HTML and heading order | one `<h1>`, then `<h2>`, no skipping |
| 8 | Buttons for actions, links for navigation | `<div onClick>` is invisible to a keyboard and a screen reader |
| 9 | Loading and error states announced | `aria-live` on the region that changes |
| 10 | Never disable zoom | no `maximum-scale=1` in the viewport meta |

`eslint-plugin-jsx-a11y` is already configured and will catch several of these at
lint time. Do not disable its rules to make a build pass.

---

## 8. Testing

We are not chasing a coverage number. We are testing the things that would be
embarrassing to get wrong.

| Priority | Test | Why |
|---|---|---|
| **High** | service-layer business rules | the three endorsement types are the product |
| **High** | auth and permissions | a permission bug is a data breach |
| **High** | validation boundaries | empty, too long, wrong type, negative |
| Medium | endpoints end-to-end (happy path + main error) | catches wiring mistakes |
| Medium | components with real logic | conditional rendering, form validation |
| Low | pure helpers | cheap, so do it |
| Skip | presentational components | testing that antd renders is testing antd |

**Backend**

```python
# tests/modules/test_jobs_service.py
import pytest

from app.core.exceptions import ForbiddenError
from app.modules.jobs import service


async def test_unverified_company_cannot_post_a_job(session, unverified_company, user):
    payload = make_job_payload(company_id=unverified_company.id)

    with pytest.raises(ForbiddenError):
        await service.create_job(session, payload, posted_by=user)
```

**Frontend**

```jsx
// features/jobs/components/JobCard.test.jsx
import { render, screen } from '@testing-library/react'

import { JobCard } from './JobCard'

it('hides the save button when no handler is given', () => {
  render(<JobCard job={makeJob()} />)

  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
})
```

| Rule | Why |
|---|---|
| Test names describe behaviour, not method names | `test_unverified_company_cannot_post_a_job`, not `test_create_1` |
| One behaviour per test | a failing test should point at one cause |
| Query by role and label, not CSS classes | that is how a user (and a screen reader) finds things |
| Tests must not depend on each other or on order | flaky tests get ignored, then deleted |
| A bug fix comes with a test that would have caught it | otherwise it comes back |

Run them:

```powershell
# backend/
uv run pytest

# frontend/
npm run test:run
```

---

## 9. Git

See **[GIT_WORKFLOW.md](GIT_WORKFLOW.md)** for the full workflow. The short
version:

| | |
|---|---|
| Branches | `feature/*` → PR → `develop` → PR → `main` |
| Direct push to `main` / `develop` | blocked, for everyone |
| Every PR | 1 approval from another member |
| Merge method | Squash and merge, always |
| Commit format | Conventional Commits — `feat(jobs): ...` |

---

## 10. Documenting decisions (ADRs)

When you make a decision that someone will later ask "why?" about, write it down
in `docs/adr/`, one short file per decision:

```
docs/adr/0001-monorepo-over-two-repos.md
docs/adr/0002-javascript-over-typescript.md
docs/adr/0003-antd-over-tailwind.md
docs/adr/0004-eslint-pinned-to-9.md
```

Template:

```markdown
# ADR 0004: Pin ESLint to 9.x

- **Status:** accepted
- **Date:** 2026-08-27
- **Decision by:** Rafay

## Context
ESLint 10 is released, but eslint-plugin-jsx-a11y and eslint-plugin-import only
support up to 9. ESLint 10 removed internal APIs those plugins rely on, so
installing it breaks `npm run lint` at runtime, not just with a peer warning.

## Decision
Pin eslint and @eslint/js to 9.x.

## Consequences
- Full plugin ecosystem works, including our accessibility rules.
- We are one major version behind and must revisit when the plugins catch up.
- Rejected: dropping jsx-a11y to get ESLint 10. Accessibility matters more than
  a version number.
```

These are cheap to write and they are the best answer to a supervisor asking why
the project is built the way it is.

---

## 11. Definition of Done

A feature is not done when it works on your machine. It is done when all of
this is true:

- [ ] It does what the spec says (cite the module number in the PR)
- [ ] Layers respected — no logic in routers, no SQL outside repositories
- [ ] Input validated with a Pydantic schema
- [ ] Authorisation checked on every new endpoint
- [ ] All four frontend states handled: loading, error, empty, success
- [ ] Error messages are human-readable and actionable
- [ ] Keyboard-navigable, inputs labelled, `jsx-a11y` clean
- [ ] Model change ships with a migration, in the same PR
- [ ] `.env.example` updated if a setting was added
- [ ] Tests for the business rules and permissions
- [ ] `npm run lint` and `npm run build` clean
- [ ] `uv run ruff check .` and `uv run pytest` clean
- [ ] No secrets, no `console.log`, no commented-out code, no `TODO` without an issue
- [ ] Manually tested in the browser, including one failure case
- [ ] PR description explains what, why and how
- [ ] Reviewed and approved by another team member

---

## 12. Code review checklist

For the reviewer. Work down the list — the first section matters most.

**Security first**

- [ ] No `.env`, `.env.local`, `node_modules/`, `.venv/` in the diff
- [ ] No hard-coded password, token or key
- [ ] Every new endpoint checks authorisation
- [ ] No user input interpolated into SQL
- [ ] Response schemas do not expose internal fields

**Correctness**

- [ ] Does it do what the description claims?
- [ ] Edge cases: empty, null, very long, negative, duplicate
- [ ] Errors handled, not swallowed
- [ ] Model change has a matching migration

**Architecture**

- [ ] Files in the right layer
- [ ] No cross-feature imports into internals
- [ ] Business logic in `service.py`, not `router.py`
- [ ] Nothing duplicated that already exists in `shared/` or `core/`

**Readability**

- [ ] Names say what things are
- [ ] Comments explain why, not what
- [ ] Public functions have docstrings
- [ ] Components under ~150 lines

**Frontend**

- [ ] Loading, error and empty states present
- [ ] Server data in React Query, not zustand
- [ ] Inputs labelled, keyboard reachable

Say what you checked in your review comment. An empty "LGTM" is not a review.

---

## 13. Changing these standards

This document is not sacred. If a rule is slowing us down or turns out to be
wrong, open a PR that changes it and explain why. Rules with no owner and no
reasoning rot.

Everything here is enforced three ways:

| Enforcement | What it catches |
|---|---|
| **Tooling** — ESLint, ruff, Prettier | formatting, imports, boundaries, accessibility |
| **Review** — sections 11 and 12 | design, correctness, security, naming |
| **Habit** — us | everything the first two cannot see |

The tooling is the cheapest of the three. When you find yourself repeating the
same review comment, add a lint rule instead.

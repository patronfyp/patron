# Testing Guide

How to write tests on Patron, for a team that has not written tests before.

Every example here is from real code in this repository, and every one of them
passes today. Copy them.

**Related:** [STANDARDS.md §8](STANDARDS.md#8-testing) decides *what* is worth
testing. This document is *how*.

---

## Start here

### A test is three lines of thinking

```
Arrange  - set up whatever the test needs
Act      - do the one thing you are testing
Assert   - check the result
```

That is the whole idea. Everything below is detail.

```python
async def test_health_returns_ok(client):
    response = await client.get("/health")          # Act

    assert response.status_code == 200              # Assert
    assert response.json()["status"] == "ok"
```

### Run them

```powershell
cd backend
uv run pytest                 # all backend tests
uv run pytest -v              # with each test name printed
uv run pytest -k health       # only tests with "health" in the name
```

```powershell
cd frontend
npm test                      # watch mode - reruns on save
npm run test:run              # once (what CI runs)
npm run test:coverage         # with a coverage report
```

Use `npm test` (watch mode) while writing. It reruns the moment you save, so
you get an answer in under a second.

### Where tests live

| | Location | Naming |
|---|---|---|
| Backend | `backend/tests/` | `test_<thing>.py` |
| Frontend | next to the file it tests | `<Thing>.test.jsx` |

Backend tests sit in their own folder because pytest is configured to look
there. Frontend tests sit beside the component — `App.jsx` and `App.test.jsx`
in the same directory — so you cannot miss that a test exists, and you delete
both together.

### What to test — the short version

| Test this | Skip this |
|---|---|
| Business rules — *"can an unverified employee refer?"* | that an antd Button renders |
| Permissions — *"can I see someone else's data?"* | CSS and layout |
| Validation — empty, too long, wrong type, negative | trivial getters |
| Endpoints — happy path **and** the main error | third-party libraries |
| Anything you just fixed a bug in | |

We are not chasing a coverage percentage. We are testing the things that would
be embarrassing to get wrong.

### The three rules that matter most

| # | Rule |
|---|---|
| 1 | **Test names describe behaviour.** `test_unverified_company_cannot_post_a_job`, not `test_create_1`. A failing test should read like a sentence. |
| 2 | **One behaviour per test.** A failure should point at one cause. |
| 3 | **Tests must not depend on each other or on order.** Each sets up its own state. |

---

## 1. Backend tests

### 1.1 The files we have

```
backend/tests/
├── conftest.py          shared fixtures - pytest finds this automatically
└── test_health.py       3 tests
```

### 1.2 Fixtures — `conftest.py`

A **fixture** is reusable setup. You declare it once and any test can ask for it
by naming it as an argument. `conftest.py` is a magic filename: pytest loads it
automatically, and tests never import it.

```python
@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client wired directly into the app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
```

Then any test just asks for it:

```python
async def test_health_returns_ok(client):   # <- pytest passes the fixture in
    response = await client.get("/health")
```

**`ASGITransport` is the important part.** It calls FastAPI in-process — no
server has to be running, and nothing goes over the network. That makes tests
fast and means they cannot fail because a port was busy.

`yield` instead of `return` means the code after `yield` runs as cleanup, after
the test finishes. This is how a fixture tidies up after itself.

### 1.3 A real gotcha we already hit

The first time these tests ran, two passed and one failed with:

```
RuntimeError: Event loop is closed
```

**Why.** The database engine in `db.py` is created once when the module is
imported, and its connection pool holds connections belonging to whichever
event loop first used them. pytest gives each test a *fresh* event loop, so the
second test inherited a connection tied to the previous — now closed — loop.

**The fix**, in `conftest.py`:

```python
@pytest.fixture(autouse=True)
async def _close_database_connections() -> AsyncIterator[None]:
    yield
    await engine.dispose()
```

`autouse=True` means this runs for **every** test without being asked for.
Disposing the engine after each test returns the pooled connections before the
loop closes.

Worth knowing because you will hit the same thing the moment you write the
first test that touches the database in a new way. It is not your bug — it is
how async connection pools and per-test event loops interact.

### 1.4 The tests themselves

```python
async def test_health_returns_ok(client: AsyncClient) -> None:
    """The endpoint responds 200 and reports the service as healthy."""
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_health_reports_the_database_as_reachable(client: AsyncClient) -> None:
    """The health check actually queries the database, not just the app."""
    response = await client.get("/health")

    assert response.json()["database"] == "ok"


async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    """A negative test: asserting what the system refuses to do."""
    response = await client.get("/this-route-does-not-exist")

    assert response.status_code == 404
```

Three things to copy:

| Pattern | Why |
|---|---|
| `async def` with no marker | `asyncio_mode = "auto"` in `pyproject.toml` handles it |
| A docstring saying what behaviour is covered | the test name is short; the docstring gives the reason |
| One negative test | tests that only cover the happy path miss most real bugs |

### 1.5 Testing a service function (what Sprint 1 onwards looks like)

Most of your tests will not go through HTTP at all. The valuable ones call the
service layer directly — that is where the business rules live, and calling a
function is far simpler than building a request.

```python
import pytest

from app.core.exceptions import ForbiddenError
from app.modules.jobs import service


async def test_unverified_company_cannot_post_a_job(session, unverified_company, user):
    # Arrange
    payload = JobCreate(title="Backend Engineer", description="..." , company_id=unverified_company.id)

    # Act + Assert - pytest.raises asserts that the call fails, and how
    with pytest.raises(ForbiddenError):
        await service.create_job(session, payload, posted_by=user)
```

`pytest.raises` is how you test failure. If the call *succeeds*, the test fails —
which is exactly what you want, because silently allowing a forbidden action is
the bug.

**This is the shape of a test that earns its keep.** `STANDARDS.md` marks
business rules and permissions as the highest testing priority, and this is what
that looks like in practice.

### 1.6 Useful pytest bits

| Thing | Use |
|---|---|
| `pytest.raises(SomeError)` | assert the call fails with that error |
| `@pytest.mark.parametrize` | run the same test with several inputs |
| `pytest -k <word>` | run only matching tests |
| `pytest -x` | stop at the first failure |
| `pytest --lf` | rerun only what failed last time |
| `pytest -s` | show `print()` output |

`parametrize` saves a lot of duplication:

```python
@pytest.mark.parametrize("justification", ["", "too short", "x" * 5001])
async def test_invalid_justification_is_rejected(client, justification):
    response = await client.post("/api/v1/referrals", json={"justification": justification})

    assert response.status_code == 422
```

One test function, three cases, three separate results in the report.

---

## 2. Frontend tests

### 2.1 The file we have

```
frontend/src/App.test.jsx     3 tests
```

### 2.2 The one rule that makes frontend tests worth writing

> **Query the way a user finds things — by visible text and role, not by CSS
> class or component internals.**

| ✅ | ❌ |
|---|---|
| `screen.getByRole('button', { name: /log in/i })` | `container.querySelector('.ant-btn-primary')` |
| `screen.getByLabelText('Email')` | `wrapper.find('Input').at(0)` |
| `screen.findByText('Backend connected')` | checking component state directly |

A test written the first way survives a refactor and fails when the
user-visible behaviour actually breaks. Written the second way it does the
opposite: it breaks when you rename a class, and passes while the screen is
unusable.

It has a second benefit: `getByRole` and `getByLabelText` only find things that
are properly labelled — so a passing test is also weak evidence that the screen
is accessible.

### 2.3 Rendering with providers

`App` needs React Query, so a bare `render(<App />)` throws. Wrap it:

```jsx
function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}
```

| Detail | Why |
|---|---|
| A **fresh** `QueryClient` per test | otherwise cached data leaks between tests and they stop being independent |
| `retry: false` | React Query retries failed requests by default, which makes the error test slow for no benefit |

As the app grows, this helper moves into `src/test/` so every test uses the same
one.

### 2.4 Mocking the API

Tests must never hit the network. A test that needs the backend running is not a
unit test — it is a second way for the suite to fail.

```jsx
vi.mock('./lib/api', () => ({
  api: { get: vi.fn() },
}))
```

This replaces the whole module with a fake. Then each test decides what the fake
returns:

```jsx
// success
api.get.mockResolvedValue({ data: { status: 'ok', env: 'test', database: 'ok' } })

// failure
api.get.mockRejectedValue(new Error('Network Error'))

// never resolves - stays in the loading state
api.get.mockReturnValue(new Promise(() => {}))
```

That third one is the trick for testing a loading state, which is otherwise hard
to catch.

`vi.clearAllMocks()` in `beforeEach` resets call history between tests.

### 2.5 `getBy` vs `findBy` vs `queryBy`

This trips up everyone once.

| Prefix | Waits? | Not found? | Use for |
|---|---|---|---|
| `getBy...` | no | **throws** | something already on screen |
| `findBy...` | yes (async) | throws after timeout | something that appears after a request |
| `queryBy...` | no | returns `null` | asserting something is **absent** |

```jsx
// appears after the request resolves -> findBy, and await it
expect(await screen.findByText('Backend connected')).toBeVisible()

// already there -> getBy
expect(screen.getByText('test')).toBeVisible()

// asserting absence -> queryBy (getBy would throw before you could assert)
expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
```

### 2.6 The three states, tested

```jsx
it('shows the backend details once the health check succeeds', async () => {
  api.get.mockResolvedValue({ data: { status: 'ok', env: 'test', database: 'ok' } })

  renderApp()

  expect(await screen.findByText('Backend connected')).toBeVisible()
  expect(screen.getByText('test')).toBeVisible()
  expect(api.get).toHaveBeenCalledWith('/health')
})

it('shows an error when the backend cannot be reached', async () => {
  api.get.mockRejectedValue(new Error('Network Error'))

  renderApp()

  expect(await screen.findByText('Backend not reachable')).toBeVisible()
})

it('shows a loading state before the request resolves', () => {
  api.get.mockReturnValue(new Promise(() => {}))

  renderApp()

  expect(screen.getByText(/checking backend/i)).toBeVisible()
})
```

`STANDARDS.md §4.6` requires every screen to handle loading, error, empty and
success. These tests are how you prove it — and they are the reason that rule
does not quietly get skipped.

### 2.7 Simulating user actions

For anything a user does, use `user-event`, not `fireEvent`. It simulates real
interaction — focus, keyboard, pointer events — so it catches things
`fireEvent` misses.

```jsx
import userEvent from '@testing-library/user-event'

it('shows a validation error when email is empty', async () => {
  const user = userEvent.setup()
  render(<LoginForm />)

  await user.click(screen.getByRole('button', { name: /log in/i }))

  expect(await screen.findByText(/email is required/i)).toBeVisible()
})

// typing
await user.type(screen.getByLabelText('Email'), 'test@example.com')

// selecting
await user.selectOptions(screen.getByLabelText('Role'), 'Candidate')
```

Every `user.*` call is `await`ed. Forgetting the `await` is the most common
cause of a frontend test that fails for no visible reason.

### 2.8 A gotcha already fixed for you

antd calls `window.matchMedia` to decide responsive layout, and jsdom does not
implement it. Without a stub, components throw on render. `src/test/setup.js`
now provides one — you do not need to do anything, but that is why the file
contains more than one line.

---

## 3. What CI does with your tests

Every pull request runs both suites on a clean machine:

| Job | Runs |
|---|---|
| Frontend | `npm run test:run` |
| Backend | `uv run pytest` against a throwaway PostgreSQL 18 |

If a test fails, the pull request shows ❌ and **the merge button is disabled** —
required status checks are enabled on `main` and `develop`. Not by convention;
GitHub refuses.

So a broken test is not a nuisance you can merge past. Which is the point.

> Two temporary allowances were removed once these first tests landed:
> `--passWithNoTests` on the frontend, and a tolerance in `ci.yml` for pytest's
> "no tests collected" exit code. An accidentally empty test suite now fails
> the build, as it should.

---

## 4. Writing your first test — the actual process

1. **Pick one behaviour.** Not a file, not a feature — one behaviour. *"An
   unverified company cannot post a job."*
2. **Name the test after it.**
   `test_unverified_company_cannot_post_a_job`
3. **Write the assert first.** What should be true? Work backwards from there.
4. **Make it fail.** Run it before the fix exists, or temporarily break the
   code. A test that has never failed is not proof of anything — it might be
   asserting nothing.
5. **Make it pass.**
6. **Run the whole suite.** Make sure you did not break another test.

Step 4 is the one everyone skips, and it is the one that catches a test asserting
`assert True` by accident.

---

## 5. When a test fails

| First | Read the failure message |
|---|---|

pytest and Vitest both print the expected value, the actual value, and the line.
That is usually the whole answer.

```
E       assert 'unreachable' == 'ok'
E         - ok
E         + unreachable
```

That is not a test problem — the database was down.

| Situation | What it usually means |
|---|---|
| Fails locally **and** in CI | a real bug — fix the code |
| Passes locally, fails in CI | something exists on your machine that CI does not have (a global package, a stale `.env`, an already-migrated database) |
| Passes alone, fails with the suite | tests are sharing state — find what is not being cleaned up |
| Fails intermittently | a missing `await`, or a timing assumption. Fix it or delete it; a flaky test gets ignored, then trusted, then wrong |

Debugging:

```powershell
uv run pytest -x -vv               # stop at first failure, verbose diff
uv run pytest --lf                 # rerun only last failures
uv run pytest -s                   # show print() output
```

```jsx
screen.debug()                     // prints the current DOM
screen.debug(screen.getByRole('form'))   // prints one element
```

`screen.debug()` is the single most useful frontend debugging tool — it shows
you exactly what the test can see, which is often not what you assumed.

---

## 6. Checklist

Before you push:

- [ ] Test name describes the behaviour, not the function
- [ ] One behaviour per test
- [ ] Business rules and permission checks covered
- [ ] At least one negative case (what should be refused)
- [ ] Frontend: queried by role/label/text, not CSS class
- [ ] Frontend: every `user.*` call is awaited
- [ ] No network calls — the API is mocked
- [ ] The test has failed at least once, on purpose
- [ ] `uv run pytest` and `npm run test:run` both pass
- [ ] A bug fix comes with a test that would have caught it

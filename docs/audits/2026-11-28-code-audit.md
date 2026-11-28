# Code audit - 28 Nov 2026

Scope: backend and frontend on `develop` at `e24e0fa` (after Sprint 4).
Method: reading the code, static scans, 19 real attack attempts against the API,
a database index check, `npm audit` and `pip-audit`. Nothing was changed; this is
the list of what to fix.

## Verdict

The foundations are sound: every endpoint is authenticated or deliberately public,
authorization holds under attack, and the data layer has no N+1 on the new list
endpoints. The gaps are **hardening** (headers, dependency updates, token
revocation), not holes in the design.

## What was tested and held

| Check | Result |
|---|---|
| Every route takes `CurrentUser` or is on an explicit public list | 53 routes, no surprise |
| Public profile and people search never return email, phone, salary, CV | pass |
| Another user reading my CV, accepting my connection request, marking my notification read | blocked (404) |
| Giving yourself `admin` (PATCH, `/auth/role`, register) | blocked (422) |
| A refresh token used as an access token; a garbage token | 401 |
| Login errors for a wrong password vs an unknown email | identical |
| SQL-looking text in search; `%` and `_` as wildcards | harmless |
| Path traversal on photo and logo URLs (three encodings) | blocked |
| Fake image type, and a 6 MB image | refused (422) |
| Raw SQL in `app/` | only `SELECT 1` and column defaults; all queries use bound parameters |
| Logs | no password, token or code is logged (two lines mention a user id or field names only) |
| Passwords | bcrypt, 72-byte limit enforced in schemas |
| Uploads | real file signature checked, 5 MB cap, never read past the cap |
| Module layout | all 7 modules have the five-file layout; `auth` has one allowed extra (`linkedin.py`) |

## Findings, most important first

### High
1. **A vulnerable frontend dependency.** `npm audit`: `follow-redirects` (high, advisory
   GHSA-mrwp-f3q8-3g9p), a transitive dependency of axios. Fix: `npm audit fix`.
2. **Vulnerable backend dependencies.** `pip-audit`: `certifi` (fix 2026.10.18) and
   `dnspython` (fix 2.9.2). Fix: `uv lock --upgrade-package certifi --upgrade-package dnspython`.
3. **No security headers.** Responses lack `X-Content-Type-Options`, `X-Frame-Options`,
   `Strict-Transport-Security`, `Content-Security-Policy` and `Referrer-Policy`. One small
   middleware fixes all five. (Part of the deploy work, #114, but cheap to do now.)

### Medium
4. **Access tokens can't be revoked** before they expire (15 minutes). A password change
   already invalidates older tokens (`password_changed_at`), but deactivating or deleting
   an account is only checked per request via `is_active`. This is acceptable at this size;
   note it for production.
5. **CORS is wide on methods and headers** (`["*"]`). Origins are explicit and credentials are
   on, which is the part that matters; narrowing methods/headers is hygiene.
6. **`secret_key` has no strength check.** A 3-character key would start the app. Add a minimum
   length (32) and refuse the placeholder from `.env.example`.
7. **Three foreign keys have no index:** `companies.created_by`, `company_invites.invited_by`,
   `jobs.created_by`. They are only used for "who made this" lookups and `ON DELETE`, so
   today it costs nothing; once users can be deleted, the cascade scans those tables.
8. **Two repository lists have no limit:** `verification.list_verified_emails` and
   `list_documents`. Both are per user and tiny in practice, but STANDARDS says lists are capped.
9. **Large frontend files:** `AllSetPage.jsx` 560 lines and `OnboardingPage.jsx` 420 lines hold
   several components each (one per role). Split per role when they next change.

### Low
10. **Local-disk uploads** (ADR 0018): files vanish on a redeploy. Known; #112 on hold.
11. **Email is sent inside the request** (#113 on hold).
12. **Tokens in `localStorage`** (when "keep me signed in" is on) are readable by any script on
    the page. No XSS sink was found (`dangerouslySetInnerHTML`, `innerHTML`, `eval`: none),
    and user text is escaped in emails. A strict CSP (finding 3) is the real mitigation.
13. **Frontend has 14 inline `style={{}}` uses**, mostly in the older auth pages. They bypass
    the theme file; move them to CSS modules when those pages are next touched.
14. **Two `key={index}`** (a password-strength bar and a skeleton list): both static lists, so
    harmless.
15. **Tests:** every backend module has tests. Frontend has no end-to-end test; the 4
    `authStore.test.js` failures happen only on machines where jsdom has no `localStorage`.

## Fixed on `chore/audit-fixes`

| # | Fix |
|---|---|
| 1 | `npm audit fix`: production dependencies now report 0 vulnerabilities |
| 2 | `certifi` 2026.11.20 and `dnspython` 2.9.2; `pip-audit` reports none |
| 3 | `SecurityHeadersMiddleware` adds the five headers (plus `Permissions-Policy`) to every response; the API's CSP is `default-src 'none'`, the docs page gets a relaxed one |
| 5 | CORS methods limited to GET, POST, PUT, PATCH, DELETE and headers to Authorization and Content-Type |
| 6 | The app refuses a `SECRET_KEY` shorter than 32 characters or equal to the `.env.example` placeholder |
| 7 | Indexes on `companies.created_by`, `company_invites.invited_by`, `jobs.created_by` (migration `c271980e8ee8`) |
| 8 | Both per-user verification lists are capped at 50 (verified emails are also de-duplicated) |

Not changed on purpose: 4 (token revocation), 9 (split the large files when they are next
edited), and the low-priority items.

## Suggested order

1. Dependencies (findings 1 and 2), 10 minutes.
2. Security headers middleware and the `secret_key` check (3 and 6), 30 minutes, with tests.
3. Indexes for the three foreign keys and limits for the two lists (7 and 8), one migration.
4. The rest as part of the work that touches those files.

# ADR 0025: Job lifecycle - draft, open, closed, with read-time expiry

- **Status:** accepted
- **Date:** 2026-11-28
- **Decision by:** Rafay

## Context

Recruiter onboarding (#106) creates draft jobs. Job posting (#129, Modules
4.1, 4.7, 4.10) turns a draft into a real posting, closes it, and expires old
ones. Later, referrals and applications will point at a job, so a published
job's record must outlive it being taken down.

## Decision

1. **Three stored statuses:** `draft`, `open`, `closed`. Changes go through
   `publish`, `close` and `reopen` endpoints, never a PATCH of `status`.

   ```
   draft --publish--> open --close--> closed --reopen--> open
                       (past expires_at: "expired") --reopen--> open
   ```
2. **Publishing needs a full posting:** a description of at least 50
   characters, a job type (full-time / part-time / contract / internship) and a
   level (intern / junior / mid / senior / lead). An open job can't lose them.
3. **Expiry is computed when reading, not by a scheduled job.** Publishing sets
   `expires_at` to 7-90 days ahead (default 30). An open job past that date is
   shown as `expired` and filtered out of open lists by the query itself
   (`expires_at > now`). Reopening sets a fresh expiry.
4. **Only drafts are deleted.** A published job is closed instead, so future
   referrals and applications keep a job to point at.
5. **The company's list is paged** (`{items, total}`, newest first, limit
   ≤ 100) and filters by the displayed status, `expired` included. An index on
   (`status`, `published_at`) serves the public listing (#130).

## Consequences

**Positive**
- No background worker for expiry: nothing to run, schedule or monitor, and a
  job is never "open" for even a minute after its date.
- Job history is kept for referrals.
- One clear rule for what "open" means, used by every query.

**Negative**
- A stored `open` can be expired; every query for open jobs must use the shared
  `status_filter` (in `jobs.repository`), never `status == "open"` alone.
- Nothing notifies a recruiter when a job expires; that comes with
  notifications completion (Sprint 14) or a scheduled job later.

## Alternatives considered
- **A scheduled job that flips expired jobs to closed** - rejected for now: needs
  a worker (#113 is on hold) and leaves a gap between expiry and the next run.
- **Allow deleting published jobs** - rejected: would orphan referrals.
- **A free-text level or years of experience** - rejected: five fixed levels are
  what the filters need, and what candidates search by.

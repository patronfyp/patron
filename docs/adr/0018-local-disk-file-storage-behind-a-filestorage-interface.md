# ADR 0018: Local-disk file storage behind a `FileStorage` interface

- **Status:** accepted
- **Date:** 2026-10-13
- **Decision by:** Rafay
- **Supersedes:** —

## Context

The onboarding wizard's backend needed somewhere to put uploaded files -
profile photos, CVs, registrar records and employment letters. A cloud
object store (S3, Cloudinary) is the eventual real answer: durable,
served over a CDN, survives a redeploy. But provisioning one, wiring
credentials, and handling its failure modes is real setup cost this
project does not need yet, and every upload so far is small (CVs,
photos, a handful of documents).

## Decision

Define one `FileStorage` interface in `app/core/storage.py`. The only
implementation for now writes to local disk (`UPLOAD_DIR`, default
`backend/uploads/`, git-ignored). Every upload goes through this
interface, never through a direct filesystem call elsewhere in the
codebase. `app/core/uploads.py` checks the real file type from its first
bytes - a PDF renamed to `.png` is refused - and caps uploads at 5 MB,
regardless of which storage backend is behind the interface.

## Consequences

**Positive**
- Switching to S3 or Cloudinary later is one new class implementing
  `FileStorage` - no call site that uploads or reads a file changes.
- No cloud credentials, billing, or network failure modes to handle during
  development, when the team is iterating on the onboarding flow daily.
- Content-based type checking and the size cap are enforced once, in
  `app/core/uploads.py`, regardless of which `FileStorage` implementation
  is active - a future S3 swap does not need to re-implement either check.

**Negative**
- Local disk does not survive a redeploy on most hosting platforms, and
  is not shared across multiple backend instances - this must change
  before a real deployment with more than one server.
- No CDN; every file is served through the backend process instead of
  offloaded to edge caching.

## Alternatives considered
- **Integrate S3 (or Cloudinary) now** - rejected for this stage. Real
  cost (an account, credentials, a bucket, IAM policy) for a problem local
  disk already solves while the team is still building the upload flows
  themselves, not yet deploying for real users.
- **Store files as bytes in the database** - rejected outright. Bloats
  database backups and query performance for data that was never
  relational to begin with; this is a well-known anti-pattern, not a
  genuine option.

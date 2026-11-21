# ADR 0024: Trigram indexes for people search

- **Status:** accepted
- **Date:** 2026-11-21
- **Decision by:** Rafay

## Context

People search (#120) finds users whose name, job title, company or university
*contains* what was typed ("bil" finds "Bilal", "garn" finds "Garner"). A
"contains" match (`ILIKE '%bil%'`) can't use an ordinary B-tree index, so
every search would read every user and profile row.

## Decision

1. **Enable `pg_trgm`** (ships with PostgreSQL) in a migration, and add **GIN
   trigram indexes** on `users.full_name` and `profiles.job_title`,
   `employer_name` and `university`.
2. **Match with `ILIKE` on the raw columns**, not `lower(col) LIKE ...`
   (SQLAlchemy's `icontains`), which the indexes can't serve. `%`, `_` and `\`
   in the query are escaped, so they are plain text.
3. **Search each table on its own and combine the ids with `UNION`.** An `OR`
   across the users-profiles join makes Postgres scan instead of using the
   indexes.
4. **Results:** at least 2 characters, at most 20 results, names starting with
   the query first, then by name. Never emails. 60 searches a minute per user
   (ADR 0021), so the member list can't be scraped.
5. **Relationship and badges for all results in fixed queries** (no N+1); a
   test counts statements for 3 and 12 results.

## Measured

50,000 users, every match sorted by name, first 20:

| Search | Without index | With index |
|---|---|---|
| Rare (one person matches) | 44.7 ms, full scan | 2.0 ms, trigram index |
| Common (one user in eight matches) | 47.3 ms, full scan | 43.5 ms, Postgres still scans |

## Consequences

**Positive**
- Searches for a specific person stay fast as users grow.
- No extra service (Elasticsearch etc.) to run.

**Negative**
- Four more indexes to keep up on every insert and update of those columns.
- Very common terms still sort every match. At this project's size that is
  milliseconds. If it ever matters, order by trigram similarity with a GiST
  index (`ORDER BY full_name <-> 'q' LIMIT 20`), which reads only the top results.
- Creating an extension needs a privileged role. Local PostgreSQL, the CI
  image and the managed hosts we'd deploy to (#114) all allow `pg_trgm`.

## Alternatives considered
- **No index** - rejected: a full scan for every keystroke-pause.
- **Prefix search only (`'bil%'` with a B-tree)** - rejected: "garn" must find
  "Garner Technologies", and people search by any part of a name.
- **Full-text search (`tsvector`)** - rejected: built for words, not partial
  names like "bil".
- **A search engine (Elasticsearch, Meilisearch)** - rejected: another service
  to host and keep in sync for a few thousand rows.

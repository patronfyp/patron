# ADR 0007: Referrals and Recommendations as separate tables, not one table with a type column

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

Patron is built on three structurally separate trust mechanisms —
Recommendations, Employee Referrals, and Alumni Referrals (README.md). A
Recommendation is a vouch from any connection; an Employee Referral is a
higher-trust endorsement gated on verified current employment and carries
its own consent and pipeline flow; an Alumni Referral adds a second
verification layer. The obvious shortcut is one `endorsements` table with a
`type` column (`recommendation` / `employee_referral` / `alumni_referral`).

## Decision

Model Recommendations and Referrals as separate tables (`recommendations`,
`referrals`, and later `alumni_referrals`), each with its own status
lifecycle, history and reputation tracking — not one table distinguished by
a `type` column.

## Consequences

**Positive**
- Each mechanism can evolve its own columns and constraints without
  `NULL`-heavy columns that only apply to one type (e.g. `is_bonus_eligible`
  only makes sense for Employee Referrals).
- Status transitions and business rules genuinely differ per mechanism (a
  Referral needs candidate consent before the company sees it; a
  Recommendation does not) — separate tables mean separate, checkable state
  machines instead of one table's rules branching on `type`.
- Reputation and statistics are queried per mechanism directly, matching how
  the product actually presents them to users — never conflating a
  Recommendation count with a Referral count.

**Negative**
- A query that needs "everything a candidate has received, regardless of
  type" (e.g. an activity feed) has to union three tables instead of
  filtering one.
- Three tables means three migrations and three sets of CRUD instead of one
  — more files, more repetition in the five-file module layout
  (STANDARDS.md §2.3).

## Alternatives considered
- **One `endorsements` table with a `type` column** — rejected. This is the
  core modelling decision of the product: collapsing the three mechanisms
  into one table with a type column would blur the exact structural
  separation that is the product's differentiator, and would need
  type-conditional logic scattered through the service layer instead of
  three separate, simple ones.

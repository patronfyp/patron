# ADR 0019: One `endorsements` table with a type column

- **Status:** accepted
- **Date:** 2026-10-16
- **Decision by:** Rafay
- **Supersedes:** ADR 0007

## Context

ADR 0007 modelled Recommendations, Employee Referrals and Alumni Referrals
as separate tables, explicitly rejecting a single `endorsements` table with
a `type` column - the three mechanisms have genuinely different status
lifecycles and business rules, and collapsing them risked blurring the
exact structural separation that is the product's differentiator.

Since then, Sprint 3's schema work (ADR 0015, 0016) moved the rest of the
schema toward shared, generic tables (`user_roles` instead of per-role
columns) rather than one table per concept. Building the three separate
tables ADR 0007 called for would mean three near-identical sets of status
columns, timestamps and foreign keys, and three sets of CRUD to review and
test - repetition ADR 0007 itself flagged as a cost ("three migrations and
three sets of CRUD... more files, more repetition"), without a matching
payoff: the fields the three mechanisms actually need (candidate, referrer
or recommender, status, a note, timestamps) turned out to overlap far more
than ADR 0007 anticipated, and the type-specific fields ADR 0007 worried
about (`is_bonus_eligible` for Employee Referrals) are few enough to be
nullable columns rather than a reason for three tables.

## Decision

Model Recommendations, Employee Referrals and Alumni Referrals as one
`endorsements` table with a `type` column
(`recommendation` / `employee_referral` / `alumni_referral`), rather than
the three separate tables ADR 0007 specified.

## Consequences

**Positive**
- One migration, one set of CRUD and one state machine to build, review and
  test instead of three - directly undoes the repetition cost ADR 0007
  accepted.
- "Everything a candidate has received, regardless of type" (an activity
  feed, a notification, a reputation count) is a filter on one table
  instead of a union across three - the query ADR 0007 flagged as the
  negative of its own choice.
- Still queryable per mechanism directly (`WHERE type = 'referral'`),
  matching how the product presents them to users - the one property ADR
  0007 wanted to keep.

**Negative**
- Type-conditional logic that ADR 0007 wanted to avoid now lives in the
  service layer instead of being structurally impossible - a bug that only
  affects Employee Referrals can be introduced by code that touches the
  shared `endorsements` table.
- A type-specific field "only makes sense for Employee Referrals" case
  (`is_bonus_eligible`) is a nullable column in a row most of the time,
  not a schema per mechanism - cleaner-looking tables trade for murkier
  constraints (nothing stops it being set on the wrong type without an
  explicit check).

## Alternatives considered
- **Keep ADR 0007's three separate tables** - rejected. The repetition cost
  ADR 0007 accepted as the price of structural separation turned out
  larger in practice than the separation was worth, once the actual field
  overlap between the three mechanisms became clear.

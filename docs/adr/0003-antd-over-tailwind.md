# ADR 0003: Ant Design over Tailwind or MUI

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

Patron is form-, table- and dashboard-heavy: registration forms, job listing
tables, referral pipelines, a recruiter dashboard. The frontend needed a UI
approach that covers those patterns without the team building them from
scratch.

## Decision

Use Ant Design 6 as the only UI library. No utility-CSS framework alongside
it (see ADR 0012, which reaffirms this when Tailwind was proposed again for
the auth screens).

## Consequences

**Positive**
- `Table`, `Form`, `Steps`, `Upload`, `Timeline` and Kanban-style cards ship
  ready-made — exactly the components a hiring platform needs, without
  building a component library first.
- Consistent theming through antd's token system (`config/theme.js`) means
  one place to change brand colours.

**Negative**
- antd's visual identity is recognisable as "an antd app" unless deliberately
  themed and extended — addressed in ADR 0012, not solved by this decision
  alone.
- Bundle size is larger than a headless/utility approach; not measured, but
  accepted as the cost of not hand-building form and table components.

## Alternatives considered
- **Tailwind CSS** — rejected. Tailwind gives no components, only utility
  classes; the team would still need to build every form, table and stepper
  from scratch, which is the exact cost this decision avoids.
- **MUI (Material UI)** — rejected. Material's visual language is more
  strongly associated with Google products than antd's is with any one
  brand, and antd's admin-dashboard component set (Steps, Timeline, Upload)
  maps more directly onto this product's screens.

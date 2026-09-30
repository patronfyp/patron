# ADR 0002: JavaScript over TypeScript for the frontend

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

The frontend needed a language choice. TypeScript is the industry default for
a project of this size and would catch type errors at compile time. All three
team members are new to React, and two have not used TypeScript at all.

## Decision

Use JavaScript, with JSDoc typedefs for all API response shapes and props, and
strict ESLint rules (STANDARDS.md §4.5).

## Consequences

**Positive**
- Lower learning curve; the team can start building immediately instead of
  learning React and TypeScript's type system at the same time.
- Vite allows incremental migration later — files can be renamed to `.tsx`
  one at a time without a rewrite.

**Negative**
- No compile-time type checking; type errors surface at runtime instead of in
  the editor.
- JSDoc discipline has to be enforced in review rather than by a compiler —
  a missed typedef is a silent gap, not a build failure.

## Alternatives considered
- **TypeScript** — rejected for now on learning-curve grounds, not technical
  ones. Revisit if type errors become a recurring source of bugs.

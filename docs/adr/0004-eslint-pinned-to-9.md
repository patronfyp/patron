# ADR 0004: Pin ESLint to 9.x

- **Status:** accepted
- **Date:** 2026-09-03
- **Decision by:** Rafay
- **Supersedes:** —

## Context

ESLint 10 is released, but `eslint-plugin-jsx-a11y` and `eslint-plugin-import`
only support up to 9. ESLint 10 removed internal APIs those plugins rely on,
so installing it breaks `npm run lint` at runtime — not just a
peer-dependency warning that can be ignored.

## Decision

Pin `eslint` and `@eslint/js` to `9.x` in `frontend/package.json`.

## Consequences

**Positive**
- The full plugin ecosystem works, including the accessibility rules from
  `eslint-plugin-jsx-a11y` (STANDARDS.md §7).
- `npm run lint` runs without a runtime crash on every contributor's machine.

**Negative**
- The project is one major ESLint version behind and must revisit this pin
  once the plugins catch up, or it will silently stay behind indefinitely.

## Alternatives considered
- **Upgrade to ESLint 10 and drop `jsx-a11y`** — rejected. Accessibility
  linting matters more than being on the latest lint tooling version; losing
  automated a11y checks is a worse trade than a pinned dependency.

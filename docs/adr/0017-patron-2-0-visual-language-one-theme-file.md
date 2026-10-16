# ADR 0017: PATRON 2.0 visual language from Figma, one theme file

- **Status:** accepted
- **Date:** 2026-10-11
- **Decision by:** Rafay
- **Supersedes:** ADR 0012

## Context

ADR 0012 established a visual language for hero screens, reconstructed from
`config/theme.js` and reviewed as a static HTML mock before any React was
written - there was no finished product design to draw from yet. By Sprint
3, a real Figma file existed ("PATRON 2.0 · Product Design") with its own
foundations page: a full brand and design-system spec (colours, type scale,
elevations, control sizes) that the team had not designed themselves. Two
sources of truth for the same values - the hand-authored ADR 0012 palette
and the new Figma file - would drift apart the first time either one
changed.

## Decision

Adopt the PATRON 2.0 Figma file as the single source for every visual
token, superseding ADR 0012's hand-authored palette and typography.
`config/theme.js` is copied from Figma's Foundations → Brand & design
system page (node `4:121`) and the Sign in frame (node `9:3`), not
reconstructed from guesswork:

- Fonts move from Fraunces / Inter / JetBrains Mono to **Geist** and
  **Geist Mono**, matching the Figma file exactly.
- Every semantic token (background, text, border, accent, AI, status),
  the three trust-tier colours, elevations and the type scale are copied
  from Figma, not invented.
- `cssVariables()` exposes every token as a `--patron-*` CSS variable set
  on `<html>`, so CSS files reference the token, never a hard-coded hex,
  rgba or font name.

## Consequences

**Positive**
- One source of truth: a designer can change a token in Figma and the
  change has an unambiguous target file to update, instead of two
  palettes that can silently disagree.
- Every current and future screen pulls from the same `--patron-*`
  variables, so a token change is a one-file diff instead of a
  find-and-replace across every component's CSS.

**Negative**
- ADR 0012's palette and typography choices are now historical record
  only - anyone reading it needs the "Superseded by ADR 0017" note to
  know not to use it.
- Ties the codebase to keeping `config/theme.js` manually in sync with the
  Figma file; nothing currently catches a value drifting out of date other
  than visual review.

## Alternatives considered
- **Keep ADR 0012's hand-authored palette, cherry-pick only new values from
  Figma** - rejected. Half-adopting the design system leaves two partially
  overlapping sources of truth, which is the exact problem this decision
  exists to avoid.
- **Generate `config/theme.js` from the Figma file automatically** (e.g. a
  design-tokens export plugin) - rejected for now. Worth revisiting if the
  file is updated often enough that manual copying becomes a real source of
  bugs; for now the Figma file changes rarely enough that a manual copy,
  reviewed against the file, is fast enough.

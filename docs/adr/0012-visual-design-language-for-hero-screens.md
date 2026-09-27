# ADR 0012: A visual design language for hero screens (starting with auth)

- **Status:** accepted
- **Date:** 2026-09-27
- **Decision by:** Rafay

## Context

The auth pages (login, register) were functionally correct but visually bare -
a centred `Flex` with a `Title` and a form, no card, no elevation, floating on
an empty background. The request was for "end-level" UI: polished, distinctly
Patron's, and interactive enough that the product does not feel like a
generic admin panel.

The first proposal was to add Tailwind alongside antd for this. See §4.8 of
`STANDARDS.md` and ADR 0003 - antd was already chosen deliberately, and mixing
it with a second utility-CSS framework is a known anti-pattern: Tailwind's
preflight reset overrides antd's own base styles (buttons, inputs, spacing all
shift), the two systems keep separate spacing scales, and the bundle carries
both. Adopting it here would have reversed a decision already made for good
reasons, for a problem that was actually a layout gap, not a tooling gap.

A direction was mocked as a static HTML page (colours and fonts drawn from the
existing `config/theme.js` tokens, so the preview matched what antd would
actually render) and reviewed before any React was written.

## Decision

Keep antd as the only UI library. Fix the actual gap - the absence of a shared
hero layout and a second, characterful typeface - rather than reaching for a
new library.

**Typography:** pair two faces. `Fraunces` (a display serif) for headline
moments only; `Inter` (already the UI face) for every control, label and body
of text. Loaded together in `index.html`; the pairing lives in
`config/theme.js` as `theme.token.fontFamily` (Inter, fed into antd) and the
separate `fontDisplay` export (Fraunces, used directly in JSX where a page has
a real headline).

**Colour:** extend, don't replace, the existing brand palette. `brand.deep` /
`brand.deeper` are darker steps of the same green hue as `colorPrimary`
(`#12915a`) - for the one hero panel that needs depth, not a second accent
colour competing with it.

**Layout pattern:** a two-pane "hero" layout - a dark, editorial brand pane
stating the product's actual thesis, paired with a plain, elevated form card.
For auth specifically, the brand pane rotates through Patron's three trust
tiers (Recommendation / Employee Referral / Alumni Referral) as real content,
not decoration - the same rule STANDARDS.md already applies to backend
comments applies to UI copy: say something specific to this product, not
something any SaaS auth screen could say.

**Interaction bar:** every interactive element should look interactive -
hover and focus states, a loading state on submit, a password visibility
toggle - matching what STANDARDS.md §4.6 already requires (loading, error,
empty, success) but extended to "does it feel considered", not only "does it
handle the state".

## Consequences

**Positive**
- No second styling system; STANDARDS.md §4.8 and ADR 0003 stand unchanged.
- One shared layout component means every current and future hero screen
  looks consistent for free, instead of each page inventing its own.
- The typography pairing and colour extension are small, reviewable diffs to
  an existing file (`config/theme.js`), not a new dependency.

**Negative**
- One more Google Fonts request on first load (Fraunces). Small and already
  cached alongside Inter from the same stylesheet request.
- A display face used badly (oversized, overused) looks worse than no display
  face at all - restrict it to genuine headline moments, not body text or
  form labels.
- This ADR sets a bar ("end-level", "interactive") that is more subjective
  than most of the rules in this codebase. Section 4.9 of STANDARDS.md exists
  specifically to make that bar checkable in review rather than left to taste.

## Alternatives considered

- **Add Tailwind alongside antd** - rejected. Reopens ADR 0003 for a problem
  that was a missing layout component, not a tooling gap; the reset-conflict
  and dual-spacing-scale issues are well documented, not hypothetical.
- **A component library on top of antd** (e.g. antd Pro Components) -
  rejected for now. Adds a second dependency surface for a need that a couple
  of shared components (`AuthLayout`, a hero panel) already satisfy.
- **Ship the bare layout and add polish later** - rejected. First impressions
  (the auth screens) are the wrong place to defer visual work, and STANDARDS.md
  §4.9 costs nothing to write down now versus retrofitting fifteen modules'
  worth of screens later.

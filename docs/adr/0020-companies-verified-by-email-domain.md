# ADR 0020: Companies, verified and joined by email domain

- **Status:** accepted
- **Date:** 2026-10-29
- **Decision by:** Rafay

## Context

Recruiter onboarding (#69, Figma 67:899) asks a recruiter to set up their
company, invite a hiring team and draft the roles they hire for. Until now
"where someone works" was only a string on their profile (`employer_name`),
and the frontend picked from a fixed list of eight companies.

Jobs (Module 5), employee referrals (Module 6) and the recruiter dashboard
(Module 12) all hang off a company, so the table has to be right before any
of them are built. Figma also promises "Verified companies only": every
company on PATRON must be real.

## Decision

1. **`companies` is a table**, keyed by a UUID, with a unique `domain`
   (e.g. `garner.com`). One domain is one company - no duplicates.
2. **A company is verified by its domain.** Only a recruiter whose work
   email on that domain is verified (the existing email-code flow,
   `kind = employer`) can create it. So every company row is verified by
   construction, and `verified_at` records when.
3. **Members are rows in `company_members`** (`company_id`, `user_id`,
   `role`), with roles `owner`, `recruiter`, `hiring_manager`, `interviewer`.
   The first recruiter is the `owner`.
4. **Joining is automatic by domain.** A recruiter with a verified work email
   on an existing company's domain joins it as `recruiter` - no approval
   step. Invited teammates join with the role they were invited with (#69,
   second PR).
5. **One company per user for now.** The key is (`company_id`, `user_id`) so
   several will fit later, but the service allows one membership today.
6. **Logos are PNG or JPG only**, stored through `FileStorage` like profile
   photos. SVG is refused because it can carry script.
7. Referrers keep `profiles.employer_name` for now. Linking it to
   `companies.id` is a later change, once referrals need it.

## Consequences

**Positive**
- Jobs, referrals and the dashboard get a real foreign key to point at.
- "Is this recruiter real?" is answered once, by the email domain, using
  code that already exists and is tested.
- Auto-join needs no admin screens.

**Negative**
- A company whose people only have personal email addresses can't join.
- Anyone with a verified address on a domain can join that company, so a
  former employee whose company email still works could join. Leaving or
  removing members is needed before production.
- Two sources of "where someone works" (`employer_name` and
  `company_members`) until referrers move over.

## Alternatives considered
- **An admin approves each new member** - rejected for now: it needs admin
  screens and a waiting state, and the domain check already proves the
  person works there.
- **Companies created freely and verified later** - rejected: Figma promises
  verified companies only, and unverified rows would need hiding everywhere.

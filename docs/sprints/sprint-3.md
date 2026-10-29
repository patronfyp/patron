# Sprint 3 — 12–25 Oct 2026

**Goal:** a user can prove a university or employer affiliation.

## Delivered
- #64 University/employer verification by email domain, document upload,
  and local-disk file storage behind a `FileStorage` interface (backend,
  specs 1.10, 1.11, 7.2, 6.1)
- #65 Onboarding wizard finished — remaining profile fields and the
  "All set" screen (spec 1.5)
- #78 Notifications backend (specs 11.1, 11.2, 11.6)
- #81 Notification bell, panel and app top navigation — completes the
  notification core end to end
- #87 Referrer onboarding — a user whose only role is referrer gets their
  own 3-step wizard instead of the candidate's 7, with job title, team,
  referral-team preferences and the two request-acceptance toggles
  (closes #68)
- #88 Public profile page and Edit profile, carried over from Sprint 2
  — completes specs 1.6 and 1.7 end to end (closes #70)
- #83 Change password from account settings — completes spec 1.8 end to
  end (closes #74)
- #91 Sign-in and create-account forms match Figma field by field — field
  icons, "Keep me signed in" (unchecked keeps the session for this browser
  session only), the security note, a password-strength meter and a
  required terms checkbox (specs 1.2, 1.13; closes #71)

The sprint goal is met, and then some: verification (the sprint's actual
goal) landed in the first three days, and every Sprint-2 carry-over (1.6,
1.7, 1.8) landed too.

## Not delivered
- **Recruiter onboarding** — planned for this sprint, moved to Sprint 4
  before the sprint started (#69; see the Sprint 2 report and the note
  already in this file's Sprint 3 section of AGILE_PLAN.md).

## Beyond the plan
Two gaps surfaced in #88's own review, not from the original plan: the
public profile doesn't show the `job_title` field #87 added to the
backend two days before #88 merged (#92), and Edit profile has no way to
change the referrer-specific fields #87 introduced - job title, team,
referral-team preferences, monthly limit, the two toggles (#93). Both
were done after the review, before Sprint 4 started, as separate PRs
rather than reopening #88 (#98, #100).

## Wrap-up after the review (26–29 Oct)
Before starting Sprint 4, the leftovers from Sprints 1–3 that need no Figma
work were closed:
- #90, #95, #96 — one structure for backend and frontend (STANDARDS.md §2):
  backend code inside `app/`, request logging with a request id, tests by
  module, feature helpers in `lib/`, `@/` imports, short comments. #95 also
  stopped LinkedIn profile data reaching the logs.
- #98 — job title on the public profile (closes #92)
- #100 — referrer settings on Edit profile (closes #93)
- #101 — frontend tests pass reliably in parallel on a laptop (closes #77)

Still open from these sprints, waiting on Figma access: #69 recruiter
onboarding, #76 mobile and dark-mode designs.

## Capacity
Plan estimate was ~75–90 person-hours per sprint (AGILE_PLAN §3). Sprint 3
closed all 8 planned items end to end. Three Sprint-2 carry-overs (1.6, 1.7, 1.8) landed in
the same window as Sprint 3's own goal (verification) plus notifications
and referrer onboarding - a heavier sprint than Sprint 2's capacity note
assumed, worth factoring into Sprint 4's planning rather than treating as
a one-off.

## Retro
- **Went well:**
  - The sprint goal (verification) landed in the first three days, which
    left room for all three Sprint 2 carry-overs.
  - Review caught real problems before merge: a referrer could finish
    onboarding without proving their employer (#87), and LinkedIn profile
    data was being written to the logs (#95).
  - One agreed structure (#90, #95, #96) means every feature now has the
    same folders, so any file can be found from its feature name.
- **Did not:**
  - PRs waited on small fixes. #81 sat five days for a three-file change,
    and was finished by the reviewer.
  - #71 changed hands twice (Rohan, Rafay, Umair) because only some of us
    can open the Figma file.
  - The frontend tests failed on our laptops until #77, so we ran them one
    file at a time. That was slow, and a real failure could be dismissed as
    "just a timeout".
- **Change (one, with an owner):** a PR with review comments is updated
  within two days, or the reviewer finishes it and says so on the PR.
  Owner: Rafay.

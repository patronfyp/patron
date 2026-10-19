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

The sprint goal is met, and then some: verification (the sprint's actual
goal) landed in the first three days, and every Sprint-2 carry-over (1.6,
1.7, 1.8) landed too.

## Not delivered
- **1.2, 1.13 Sign-in and create-account forms matching Figma field by
  field** — #91 is open (mail/lock/user field icons, the "Keep me signed
  in" checkbox and its actual session-storage behaviour, the security
  note box, a password-strength meter, the required terms checkbox), CI
  green, awaiting review. The Sprint 3 table in AGILE_PLAN.md keeps this
  row as **open** rather than done until #91 merges - the table should be
  updated to "done — #91" the day it does, rather than waiting for a
  future sprint report to catch it up.
- **Recruiter onboarding** — planned for this sprint, moved to Sprint 4
  before the sprint started (#69; see the Sprint 2 report and the note
  already in this file's Sprint 3 section of AGILE_PLAN.md).

## Beyond the plan
Two gaps surfaced in #88's own review, not from the original plan: the
public profile doesn't show the `job_title` field #87 added to the
backend two days before #88 merged (#92), and Edit profile has no way to
change the referrer-specific fields #87 introduced - job title, team,
referral-team preferences, monthly limit, the two toggles (#93). Both
added to Sprint 4 rather than reopening #88, since #88 itself already
shipped and these are new, separable pieces of work.

## Capacity
Plan estimate was ~75–90 person-hours per sprint (AGILE_PLAN §3). Sprint 3
closed 7 of 8 planned items end to end, with the eighth (#91) in review
rather than dropped. Three Sprint-2 carry-overs (1.6, 1.7, 1.8) landed in
the same window as Sprint 3's own goal (verification) plus notifications
and referrer onboarding - a heavier sprint than Sprint 2's capacity note
assumed, worth factoring into Sprint 4's planning rather than treating as
a one-off.

## Retro
To be filled in at the sprint review by the team:
- Went well:
- Did not:
- Change (exactly one, with an owner):

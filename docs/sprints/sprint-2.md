# Sprint 2 — 28 Sep – 11 Oct 2026

**Goal:** a user has a complete, editable profile.

## Delivered
- #48 / #54 Institutional profile fields (university, degree, year, employer)
  and resumable onboarding progress (spec 1.4)
- #49 / #55 Email verification by 6-digit code (backend, spec 1.9)
- #51 / #56 Onboarding wizard shell with the University and Employer steps
- #57 Reusable `OtpInput` component and the `verification` feature's api/hooks
- #52 / #58 Wire real email verification into the University and Employer
  steps — completes spec 1.9 end to end
- #50 / #60 Password reset via an emailed token (backend, spec 1.12)
- #59 Forgot-password and reset-password pages (frontend) — completes
  spec 1.12 end to end

The sprint goal is **partly met**: a user now has a profile with real,
verified institutional data (university/employer), but viewing and editing
that profile as a page (1.6, 1.7) and changing a password from account
settings (1.8) did not land in this window — see Not delivered.

## Not delivered
- **1.5 Profile completion wizard** — the University/Employer steps and their
  verification landed this sprint (#56, #58), but the rest of the wizard
  (headline, skills, the remaining fields, and the "All set" screen) did
  not. Completed early in Sprint 3, before this report was written: #64
  (backend) and #65 (frontend).
- **1.6 Public profile page** — not started this sprint. The backend
  endpoint landed early in Sprint 3 (#79); the frontend page is Sprint 3's
  #70, still open.
- **1.7 Profile edit** — not started this sprint. Carried into Sprint 3 as
  part of #70, still open.
- **1.8 Account settings — password change** — not started this sprint. The
  backend endpoint landed early in Sprint 3 (#79); the frontend settings
  page is Sprint 3's #74, still open.

All four carry into Sprint 3 (see its section below, updated to reflect
this).

## Beyond the plan
Not in the original Sprint 2 scope, but started once the "PATRON 2.0 ·
Product Design" Figma file existed: #61 (frontend theme switched to its
tokens) and #62 (auth layout rebuilt to match its Sign in frame). This
became the basis for the onboarding wizard UI (#65) and further Figma-matching
work tracked under Sprint 3 (#70, #71, #72).

## Capacity
Plan estimate was ~75–90 person-hours per sprint (AGILE_PLAN §3). Sprint 2
closed 7 of 7 planned issues' worth of backend/API work but only 3 of 7
specs end to end (1.4, 1.9, 1.12) — the profile-page and settings specs
(1.6, 1.7, 1.8) took longer than estimated once the Figma redesign work (not
originally planned) was folded in. Recalibrate the Sprint 3+ estimate at the
review using actual hours logged, and treat "spec land end to end" rather
than "backend merged" as the unit of done going forward.

## Retro
To be filled in at the sprint review by the team:
- Went well:
- Did not:
- Change (exactly one, with an owner):

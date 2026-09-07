# Agile Plan — Patron

How we plan, split and track work between now and submission.

**Timeline:** 8 September 2026 → **15 May 2027** (~36 weeks)
**Method:** Scrum, trimmed for a three-person part-time team
**Scope:** Phase 1 MVP — Modules 1–8 and 11 from the feature specification

---

## Start here

Everything you need day to day, on one page.

### Who does what

| | Rafay | Umair | Rohan |
|---|---|---|---|
| **Primary** | Tech lead · reviews every PR · architecture · release | Documentation owner · feature code | Feature code · reviews |
| Writes code | yes | yes | yes |
| Writes docs | yes | **owns** SRS, ADRs, API docs, user manual | yes (feature-level docs) |
| Reviews PRs | **every PR** | Umair reviews Rohan's + Rafay's | Rohan reviews Umair's + Rafay's |
| Merges to `main` | yes | — | — |

Nobody is only-docs or only-code. All three write both.

### The rhythm

| When | What | How long |
|---|---|---|
| Every day | Standup — post 3 lines in the group chat | 5 min |
| Every other Monday | Sprint planning — pick the sprint's issues | 60 min |
| Every other Sunday | Sprint review + retro — demo, then what to change | 45 min |
| Continuously | PRs raised, reviewed, merged | — |

Sprints are **2 weeks**, Monday → Sunday.

### Daily standup format

Post this in the group chat every day. No meeting needed.

```
Yesterday: finished the login form validation
Today:     wiring the refresh-token interceptor
Blocked:   need the /auth/refresh endpoint merged first (PR #23)
```

If you are blocked, say so the same day. A blocker sitting quietly for three
days is the most expensive thing that can happen to a 36-week project.

### Where the work lives

| Thing | Where |
|---|---|
| Every task | a GitHub **Issue** |
| Sprint contents | a GitHub **Milestone** (`Sprint 1`, `Sprint 2`, …) |
| Current state of work | the **Project board** (Backlog → Ready → In progress → In review → Done) |
| The code | a PR linked to its issue |

One issue = one PR = one branch. If an issue needs three PRs, it was too big —
split it.

### The sprint at a glance

| Sprint | Dates | Focus |
|---|---|---|
| 0 | 26 Aug – 13 Sep | Setup, tooling, docs ✅ **done** |
| 1 | 14 – 27 Sep | Auth foundation — the reference module |
| 2 | 28 Sep – 11 Oct | Profile & account lifecycle |
| 3 | 12 – 25 Oct | University/employer verification + notification core |
| 4 | 26 Oct – 8 Nov | Connection system + type tagging |
| 5 | 9 – 22 Nov | Companies + job posting |
| 6 | 23 Nov – 6 Dec | Job discovery — search, filters, detail page |
| 7 | 7 – 20 Dec | ⭐ Recommendation Engine |
| 8 | 21 Dec – 3 Jan | **Light** — buffer, mid-evaluation, docs catch-up |
| 9 | 4 – 17 Jan | ⭐ Employee Referral Engine |
| 10 | 18 – 31 Jan | ⭐ Alumni Network & directory |
| 11 | 1 – 14 Feb | ⭐ Alumni Referral + Double-Verified flag |
| 12 | 15 – 28 Feb | Company / Recruiter dashboard |
| 13 | 1 – 14 Mar | CV Builder |
| 14 | 15 – 28 Mar | Notifications completion + integration hardening |
| 15 | 29 Mar – 11 Apr | Testing, accessibility, bug fixing |
| 16 | 12 – 25 Apr | UX polish + deployment + buffer |
| — | 26 Apr – 15 May | **Code freeze** — final docs, dry runs, defence |

⭐ = the three core differentiators. These cannot be cut.

---

## 1. Why Scrum, and which parts we actually use

### Why Agile at all

The specification has 15 modules and 100+ features. Nobody on this team has
built something this size before, so any estimate made today for March is
fiction. Agile's answer is to plan in two-week slices, show something working at
the end of each, and re-plan with what we learned.

The alternative — Waterfall — needs the whole design fixed up front. That only
works when requirements do not move. Ours already moved once: Module 7 (Alumni
Network) was added mid-way on the supervisor's request. Waterfall would have
meant redoing the plan; Agile means adding it to the backlog.

### What we keep and what we drop

Textbook Scrum assumes a full-time team of 5–9. We are three part-time students.
Copying it exactly would mean spending more time on ceremony than on code.

| Scrum practice | Us | Why |
|---|---|---|
| Sprints | ✅ 2 weeks | short enough to correct course, long enough to finish something |
| Product backlog | ✅ GitHub Issues | one list, prioritised |
| Sprint backlog | ✅ GitHub Milestone | what we committed to this sprint |
| Daily standup | ✅ **written**, in chat | a 15-min call every day costs 12 hours a sprint |
| Sprint planning | ✅ 60 min | |
| Sprint review | ✅ 45 min, includes demo | |
| Retrospective | ✅ folded into review | separate meeting is overkill at this size |
| Story points / velocity | ❌ | three people cannot calibrate points reliably; we size in days |
| Product Owner / Scrum Master roles | ❌ separate people | Rafay carries both — normal in a student team |
| Burndown charts | ❌ | the Project board already shows what is left |

> **For the viva:** if asked "did you follow Scrum?", the honest and stronger
> answer is: *"We followed Scrum's cadence and artefacts — sprints, backlog,
> planning, review, retrospective — and deliberately dropped story points and
> separate ceremonies because a three-person part-time team cannot support them.
> Here is what we did instead."* Claiming textbook Scrum you did not follow is
> the easier answer to attack.

---

## 2. Roles and responsibilities

### Rafay — Tech Lead

| Owns | Detail |
|---|---|
| Architecture | decides structure; keeps `STANDARDS.md` current |
| **Code review** | reviews every PR before it reaches `develop` |
| Release | merges `develop` → `main`, tags releases, runs the demo build |
| Backlog | writes and prioritises issues, runs sprint planning |
| Supervisor liaison | brings the plan and the demo to each meeting |
| Code | auth, cross-cutting concerns, anything that unblocks the others |

Reviewing every PR is the job that matters most here. It is how three different
styles stay one codebase, and how the other two learn fastest.

### Umair — Documentation Owner + Developer

| Owns | Detail |
|---|---|
| **SRS** | Features.pdf → a formal requirements document |
| **ADRs** | `docs/adr/` — one file per architectural decision |
| **API documentation** | FastAPI generates the OpenAPI schema; Umair writes the descriptions and examples that make it usable |
| **User manual** | screenshots + walkthrough, written as features land |
| Sprint reports | what was planned, what shipped, what slipped |
| Code | assigned feature modules, same as everyone |

Documentation is written **alongside** the feature, in the same sprint — never
saved for the end. A feature is not done until its documentation exists (see
Definition of Done).

### Rohan — Developer

| Owns | Detail |
|---|---|
| Feature modules | assigned per sprint |
| Reviews | reviews Umair's and Rafay's PRs |
| Test coverage | tests for the business rules in his modules |
| Feature docs | docstrings, endpoint descriptions, PR write-ups |

### Review pairing

Nobody approves their own PR. Rafay reviews everything; the other two cover each
other and Rafay.

| PR author | Reviewer |
|---|---|
| Rohan | Rafay (+ Umair if it touches shared code) |
| Umair | Rafay (+ Rohan if it touches shared code) |
| Rafay | Umair or Rohan |

---

## 3. Ceremonies

### Sprint planning — every other Monday, 60 minutes

1. Close the finished sprint's milestone; move anything unfinished back to the
   backlog (do **not** silently roll it forward)
2. Agree the **sprint goal** — one sentence
3. Pull issues from the backlog into the new milestone until the team is full
4. Assign an owner to each issue
5. Confirm every issue meets the Definition of Ready

**Capacity assumption:** roughly 12–15 focused hours per person per week, so
~75–90 person-hours per sprint. This is a guess until Sprint 1 finishes —
recalibrate at the Sprint 1 review using what actually got done.

### Daily standup — written, in the group chat

Three lines: yesterday / today / blocked. No call. If something is blocked,
whoever can unblock it replies the same day.

### Sprint review + retrospective — every other Sunday, 45 minutes

**Review (25 min)** — demo what works in a browser. Not slides, not
screenshots — the running app. If it cannot be demoed, it is not done.

**Retro (20 min)** — three questions:

| Question | Purpose |
|---|---|
| What went well? | keep doing it |
| What did not? | one concrete change, not a complaint |
| What will we change next sprint? | exactly one thing, with an owner |

Write the answers in `docs/sprints/sprint-<n>.md`. That file *is* the sprint
report the supervisor will ask for, and it takes ten minutes if written the same
day.

---

## 4. Sprint plan

Dependencies drive the order. Auth first, because nothing works without
identity. The endorsement engines need connections and jobs to exist first.

```
Auth (M1) ──┬──► Connections (M3) ──┬──► Recommendation (M5) ⭐
            │                       │
            ├──► Companies + Jobs ──┼──► Referral (M6) ⭐
            │         (M4/M8)       │
            └──► Verification ──────┴──► Alumni Referral (M7) ⭐
                 (1.10, 1.11)                    │
                                                 ▼
                                    Recruiter dashboard (M8)
```

### Sprint 1 — Auth foundation · 14–27 Sep

**Goal:** a user can register, log in, and reach a protected page.

| Item | Spec |
|---|---|
| `User` model + first Alembic migration | — |
| Register with email/password | 1.2 |
| Login, JWT access + refresh tokens | 1.13 |
| `get_current_user` dependency | — |
| Frontend: `features/auth/` — login and register pages | — |
| Frontend: protected routes, auth store, token refresh interceptor | 1.13 |
| Role selection at signup (Candidate / Company / Both) | 1.3 |

**Why this sprint matters most:** it creates the first real backend module and
the first real frontend feature. Whatever shape they take becomes the template
everyone copies for the next fifteen sprints. Rafay leads it; the other two
review closely and ask questions.

Also this sprint: create the ESLint boundary rules once `features/` and
`shared/` exist (STANDARDS.md §2.6).

### Sprint 2 — Profile & account · 28 Sep – 11 Oct

**Goal:** a user has a complete, editable profile.

| Item | Spec |
|---|---|
| Institutional profile fields (university, degree, year, employer) | 1.4 |
| Public profile page | 1.6 |
| Profile edit | 1.7 |
| Account settings — password change, preferences | 1.8 |
| Email verification (OTP or magic link) | 1.9 |
| Password reset via emailed token | 1.12 |
| Profile completion wizard | 1.5 |

### Sprint 3 — Verification + notification core · 12–25 Oct

**Goal:** a user can prove a university or employer affiliation.

| Item | Spec |
|---|---|
| University verification — email domain or document upload | 1.10, 7.2 |
| Employer verification — corporate domain or document upload | 1.11, 6.1 |
| File upload handling (type, size, storage) | — |
| Notification core — bell, unread count, mark read | 11.1, 11.2, 11.6 |

Verification gates Referral and Alumni Referral eligibility, so it has to exist
before those engines. Manual admin review of documents is deferred (Module 13);
for now verification is by email domain, with uploads stored and marked pending.

### Sprint 4 — Connections · 26 Oct – 8 Nov

**Goal:** users have a network, and the system knows what kind of relationship
each connection is.

| Item | Spec |
|---|---|
| Send / accept / decline connection requests | 3.1, 3.2 |
| Connections list — paginated, searchable | 3.4 |
| Remove connection, connection count | 3.7, 3.8 |
| **Connection type tagging** — Professional / Alumni / Both | **3.9** |
| Mutual connections | 3.5 |

3.9 is the critical one — it decides which endorsement types are possible
between any two people. Everything in Sprints 7, 9 and 11 reads it.

### Sprint 5 — Companies + job posting · 9–22 Nov

**Goal:** a verified company can post a job.

| Item | Spec |
|---|---|
| Company model, company profile page | 8.1 |
| Post a job — full form | 4.1 |
| Company job dashboard — list, status | 4.10 |
| Job expiry | 4.7 |

### Sprint 6 — Job discovery · 23 Nov – 6 Dec

**Goal:** a candidate can find a relevant job and see who could vouch for them.

| Item | Spec |
|---|---|
| Job listing feed, paginated | 4.2 |
| Full-text search | 4.3 |
| Multi-filter — location, salary, type, level, skills | 4.4 |
| Job detail page with context-aware CTAs | 4.5 |
| Save / bookmark a job | 4.6 |

### Sprint 7 — ⭐ Recommendation Engine · 7–20 Dec

**Goal:** anyone in a candidate's network can vouch for them, both directions.

| Item | Spec |
|---|---|
| "Request a Recommendation" flow | 5A.1 – 5A.7 |
| "Recommend Someone" flow | 5B.1 – 5B.5 |
| Candidate consent | 5B.4 |
| Recommendation card visible to the company | 5C.1 |
| Status tracker — Pending → … → Hired/Rejected | 5C.2 |
| One-per-pair-per-job restriction | 5C.4 |
| Withdrawal | 5C.5 |
| Request auto-expiry after 7 days | 5A.7 |

### Sprint 8 — Buffer & mid-evaluation · 21 Dec – 3 Jan

**Deliberately light.** University finals and holidays fall around here.

| Item |
|---|
| Fix everything that slipped from Sprints 1–7 |
| Mid-year evaluation demo prep and dry run |
| Documentation catch-up — SRS, ADRs, sprint reports |
| No new features |

Every project of this length needs slack. Planning a sprint at zero capacity is
how a plan becomes a work of fiction.

### Sprint 9 — ⭐ Employee Referral Engine · 4–17 Jan

**Goal:** a verified employee can refer a candidate into their own company.

| Item | Spec |
|---|---|
| "Refer to My Company" CTA, gated on verified employment | 6.2 |
| Select candidate, write justification | 6.3, 6.4 |
| Candidate consent | 6.5 |
| Referral ID + tracking, separate from recommendations | 6.6 |
| Referral card with verified-employment badge | 6.7 |
| Referral status tracker | 6.8 |
| Bonus-eligibility flag | 6.9 |
| One-per-pair-per-job, withdrawal | 6.11, 6.12 |

Referrals are **structurally separate** from Recommendations — separate table,
separate status, separate history. Do not model them as a "type" column on one
shared table; the whole product thesis is that these are different things.

### Sprint 10 — ⭐ Alumni Network · 18–31 Jan

**Goal:** verified alumni can find each other.

| Item | Spec |
|---|---|
| University/institution selection | 7.1 |
| Alumni directory with filters | 7.3 |
| University community page | 7.4 |
| Batch / department groups | 7.5 |

### Sprint 11 — ⭐ Alumni Referral + Double-Verified · 1–14 Feb

**Goal:** the third trust tier, and the platform's highest-trust signal.

| Item | Spec |
|---|---|
| Alumni Referral flow, gated on shared university | 7.7 |
| **Double-Verified flag** — alumnus *and* employee | **7.8** |
| Alumni referral history, tracked separately | 7.12 |
| "Employees Who Could Refer You" panel | 4.11 |
| "Alumni at This Company" panel | 4.12, 7.6 |

After this sprint the three-tier trust model is complete and demoable
end-to-end. This is the single most important demo in the project.

### Sprint 12 — Recruiter dashboard · 15–28 Feb

**Goal:** a recruiter can act on endorsements.

| Item | Spec |
|---|---|
| Kanban hiring pipeline | 8.2 |
| Candidate cards with source badges | 8.3 |
| Notes and tags | 8.7 |
| Mark as hired | 8.8 |
| Per-job analytics split by endorsement type | 8.5 |
| Team members on one company account | 8.9 |

### Sprint 13 — CV Builder · 1–14 Mar

| Item | Spec |
|---|---|
| Template gallery + preview | 2.1, 2.2 |
| Structured editor with live preview | 2.3, 2.4 |
| Multiple saved CV versions | 2.6 |
| PDF export | 2.7 |
| Auto-save | 2.8 |
| Skill tags with autocomplete | 2.10 |
| Education-to-Alumni link | 2.11 |

Scheduled late on purpose: a CV is needed for the *review* step of an
endorsement (5A.4), and until then a profile is enough.

### Sprint 14 — Notifications + integration hardening · 15–28 Mar

| Item | Spec |
|---|---|
| Transactional email notifications | 11.3 |
| Real-time updates over WebSocket | 11.4 |
| Per-category notification preferences | 11.5 |
| End-to-end pass over all three endorsement flows | — |
| Fix every seam found between modules | — |

### Sprint 15 — Testing, accessibility, bugs · 29 Mar – 11 Apr

| Item |
|---|
| Tests for every business rule and permission check |
| Full keyboard and screen-reader pass (WCAG 2.1 AA) |
| Performance — N+1 queries, missing indexes, bundle size |
| Bug bash: all three members try to break each other's features |
| Fix everything found |

### Sprint 16 — Polish, deployment, buffer · 12–25 Apr

| Item | Spec |
|---|---|
| Landing page explaining the three trust tiers | 15.1 |
| Dark mode | 15.2 |
| Responsive pass — mobile and tablet | 15.3 |
| Skeleton loaders, graceful error states | 15.4, 15.5 |
| Deploy somewhere with a public URL | — |
| Seed realistic demo data | — |
| Remaining buffer | — |

### Code freeze — 26 Apr – 15 May

| Week | Focus |
|---|---|
| 26 Apr – 2 May | **Freeze.** Critical bug fixes only, nothing new |
| 3 – 9 May | Final SRS, user manual, complete ADR set, thesis chapters |
| 10 – 15 May | Three full dry-run demos · viva prep · submission |

Nothing new gets built after 26 April. Every project that ignores its freeze
date demos something broken.

---

## 5. Definition of Ready

An issue may not enter a sprint until all of this is true. This is what stops a
sprint stalling on day three.

- [ ] Title states the outcome, not the task
- [ ] Links to the module/feature ID from the spec (e.g. "Module 6.4")
- [ ] Acceptance criteria written as a checklist
- [ ] Dependencies identified and either done or in the same sprint
- [ ] Small enough for one person to finish inside the sprint — split it if not
- [ ] Owner assigned
- [ ] Design/UX decided, if it has a UI

### Issue template

```markdown
## Outcome
As a verified employee, I can refer a connection into a job at my company.

## Spec
Module 6.2, 6.3, 6.4

## Acceptance criteria
- [ ] "Refer to My Company" appears only on jobs at a company where I have
      verified employment
- [ ] I can pick any connection and write a justification (min 50 chars)
- [ ] The candidate receives a notification and must consent before it proceeds
- [ ] A unique Referral ID is generated
- [ ] I cannot refer the same person twice for the same job (409)

## Depends on
- #14 Employer verification
- #22 Job detail page

## Notes
Referrals are a separate table from recommendations - see STANDARDS.md §2.3.
```

---

## 6. Definition of Done

Full checklist in [STANDARDS.md §11](STANDARDS.md#11-definition-of-done). The
short version:

| | |
|---|---|
| Code | layers respected, input validated, authorisation checked |
| Frontend | loading / error / empty / success all handled, keyboard-usable |
| Database | model change ships with its migration, same PR |
| Tests | business rules and permissions covered |
| Checks | lint, format, build, tests all clean |
| **Docs** | endpoint descriptions written, user manual section updated |
| Review | approved by another member, merged via squash |
| Demo | works in a browser, including one failure case |

The **Docs** row is what keeps documentation from piling up into an
impossible final week.

---

## 7. Tracking on GitHub

No Jira, no Trello. Everything lives next to the code.

### Labels

| Label | Meaning |
|---|---|
| `module:auth` … `module:referrals` | which domain |
| `area:frontend` / `area:backend` / `area:database` / `area:docs` | which layer |
| `type:feature` / `type:bug` / `type:chore` / `type:docs` | what kind |
| `priority:must` / `priority:should` / `priority:could` | MoSCoW — what gets cut first |
| `blocked` | waiting on something; needs a comment saying what |
| `good-first-issue` | small and self-contained |

### Milestones

One per sprint: `Sprint 1`, `Sprint 2`, … with the sprint's end date. GitHub then
shows completion percentage per sprint for free — that is the progress report.

### Project board

Columns: **Backlog → Ready → In progress → In review → Done**

| Rule | Why |
|---|---|
| Max 2 items per person in "In progress" | half-finished work is worth nothing |
| Move the card when the work moves | a stale board is worse than no board |
| Link every PR to its issue (`Closes #14`) | the issue closes itself on merge |

### Sprint reports

`docs/sprints/sprint-<n>.md`, written on review day:

```markdown
# Sprint 3 — 12–25 Oct 2026

**Goal:** a user can prove a university or employer affiliation.

## Delivered
- #18 University verification by email domain
- #19 Document upload with type and size validation
- #21 Notification bell with unread count

## Not delivered
- #20 Employer document review queue — moved to Sprint 4.
  Reason: file storage took two days longer than estimated.

## Retro
- Went well: reviews turned around within a day all sprint.
- Did not: two issues had no acceptance criteria and got reworked twice.
- Change: Rafay checks Definition of Ready before planning closes. Owner: Rafay.
```

Fifteen of these files are the project's development history. Written the same
day, each takes ten minutes. Reconstructed in May, they take a week and are
wrong.

---

## 8. What we measure

Two numbers, both free from GitHub.

| Metric | Where | What it tells us |
|---|---|---|
| Issues closed vs committed per sprint | Milestone page | are we planning realistically |
| PR open → merged time | Pull requests | are reviews becoming a bottleneck |

That is all. No burndown charts, no velocity graphs — at this size they cost
more to maintain than they reveal.

**Target:** a PR reviewed within 24 hours. Beyond that, work stalls and people
start branching off unmerged branches.

---

## 9. Risks

| Risk | Likelihood | Impact | What we do |
|---|---|---|---|
| Exams and other courses eat sprint capacity | high | high | Sprint 8 is deliberately light; buffer in Sprint 16; scope by MoSCoW |
| Scope creep — more supervisor-requested modules | medium | high | Phase 2 list stays explicit; new asks go to the backlog, not the sprint |
| A member falls behind or drops out | low | high | no single-person module knowledge; Rafay reviews everything; docs stay current |
| Endorsement logic turns out harder than estimated | medium | high | the three engines get their own sprints, in dependency order, with Sprint 8 as slack |
| Documentation left to the end | **medium** | high | docs are in the Definition of Done; Umair owns them; sprint reports written same-day |
| Reviews become a bottleneck | medium | medium | 24-hour review target; two reviewers per person |
| Deployment discovered to be hard in the last week | medium | medium | deploy in Sprint 16, not the freeze |
| Free-tier limits (email sending, hosting) | low | medium | identify providers by Sprint 13 |

### Scope control — MoSCoW

If we fall behind, this is the order things go:

| Priority | Contents | Cuttable? |
|---|---|---|
| **Must** | Modules 1, 3, 4, **5, 6, 7**, 8, 11 | no — 5/6/7 *are* the product |
| **Should** | Module 2 (CV Builder), most of 15 (polish) | reduce scope, don't cut |
| **Could** | 4.8 similar jobs, 3.6 suggestions, 7.10 events | cut first |
| **Won't (Phase 1)** | Modules 9, 10, 12, 13, 14 | already out of scope |

Modules 5, 6 and 7 are non-negotiable. A demo with two of the three trust tiers
does not demonstrate the product.

---

## 10. Assumptions to confirm

These dates are **estimates based on a typical academic calendar** — none of
them are confirmed. Rafay to check with the supervisor and the department at the
next meeting, then update this file:

- [ ] Final submission date — assumed **15 May 2027**
- [ ] Mid-year / interim evaluation date — assumed late December, which is why
      Sprint 8 is a buffer
- [ ] Final defence / viva date
- [ ] University exam periods that will cut into sprint capacity
- [ ] Required deliverable formats — SRS template, thesis format, demo length
- [ ] Whether the repository must be private at submission

If any of these move, the sprint calendar in §4 moves with them. Update this
document through a PR, like everything else.

---

## 11. Immediate next steps

Before Sprint 1 starts on 14 September:

| # | Task | Owner |
|---|---|---|
| 1 | Create the GitHub labels listed in §7 | Rafay |
| 2 | Create Milestones `Sprint 1` … `Sprint 16` with end dates | Rafay |
| 3 | Create the Project board with the five columns | Rafay |
| 4 | Write Sprint 1 issues to the Definition of Ready standard | Rafay |
| 5 | Set up GitHub Actions CI — lint, build, test on every PR | Rafay |
| 6 | Start the SRS: Module 1 section, as the template for the rest | Umair |
| 7 | Write ADRs 0001–0004 for the decisions already made | Umair |
| 8 | Read STANDARDS.md "Start here" and GIT_WORKFLOW.md "Start here" | Umair, Rohan |
| 9 | Confirm the dates in §10 with the supervisor | Rafay |

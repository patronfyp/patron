# Git Workflow

How we branch, commit, review and merge on Patron. Every step is given twice:
once as a terminal command, once as the equivalent in **SourceTree**. Use
whichever you prefer — they do exactly the same thing.

If something here is unclear or turns out to be wrong, fix this file and open a
PR for it. That is faster than asking the same question twice.

---

## 1. The branch model

```
main                 always demo-able. Protected: PR + 1 approval, no direct push.
 └── develop         integration branch. All feature work lands here first.
      ├── feature/login-page
      ├── fix/token-refresh
      └── docs/srs-module-1
```

| Branch | Who pushes to it | How code gets in |
|---|---|---|
| `main` | nobody | PR from `develop`, 1 approval required |
| `develop` | nobody directly | PR from a `feature/*` branch |
| `feature/*` | you, freely | this is where you work |

**Never commit directly on `main` or `develop`.** Always branch off `develop`.

### Branch naming

```
<type>/<short-kebab-case-description>
```

| Prefix | Use for | Example |
|---|---|---|
| `feature/` | new functionality | `feature/job-detail-page` |
| `fix/` | bug fix | `fix/cors-on-refresh` |
| `docs/` | documentation only | `docs/srs-module-1` |
| `chore/` | config, tooling, dependencies | `chore/add-github-actions` |
| `refactor/` | restructuring, no behaviour change | `refactor/extract-api-client` |

Keep it short and specific. `feature/auth` is too vague when three people are
working on auth; `feature/auth-login-form` is clear.

---

## 2. One-time setup

Do this once per machine, after cloning.

**Terminal**

```powershell
cd <path to patron>
git config --local user.name "Your Full Name"
git config --local user.email "your-github-email@example.com"
git config --local core.autocrlf input
```

**SourceTree**

`Repository → Repository Settings → Advanced` → tick *"Use custom author
information"* → fill in name and email.

### Why this matters

| Setting | What breaks without it |
|---|---|
| `user.name` / `user.email` | commits are attributed to the wrong identity, and you get no credit on the contributor graph |
| `core.autocrlf input` | Windows line endings leak into the repo and every diff looks like the whole file changed |

We use `--local` (this repo only) rather than `--global` so your other projects
are untouched.

### If Git keeps asking which account to use

Windows may have more than one GitHub credential stored, so Git Credential
Manager asks every time you push. Pin it:

```powershell
git config --local credential.https://github.com.username your-github-username
```

Still asking? Remove the stale entry: `Control Panel → Credential Manager →
Windows Credentials → git:https://github.com → Remove`.

---

## 3. The daily loop

Seven steps. This is the whole workflow.

```
1. get up to date       2. branch        3. work
4. commit               5. push          6. open a PR
7. review → merge → clean up
```

### Step 1 — Get up to date

Always start from the latest `develop`. Skipping this is the number one cause of
merge conflicts.

**Terminal**

```powershell
git checkout develop
git pull
```

**SourceTree**

Double-click `develop` in the left sidebar (checks it out), then click **Pull**
in the toolbar.

After pulling, check whether anything else needs updating:

| If this changed in the pull | Run this |
|---|---|
| `frontend/package.json` | `npm install` (in `frontend/`) |
| `backend/pyproject.toml` or `uv.lock` | `uv sync` (in `backend/`) |
| `backend/migrations/versions/` | `uv run alembic upgrade head` (in `backend/`) |
| `.env.example` (either side) | add the new keys to your own `.env` — see below |

`git pull` never touches your `.env` / `.env.local`, because those are not
tracked. To see what you are missing:

```powershell
cd backend
Compare-Object (Get-Content .env.example) (Get-Content .env)
```

Lines marked `<=` exist in the template but not in your file. Add them with your
own values. Same command works in `frontend/` with `.env.example` and
`.env.local`.

### Step 2 — Create your branch

**Terminal**

```powershell
git checkout -b feature/login-page
```

`-b` means "create it and switch to it".

**SourceTree**

Make sure `develop` is checked out, then toolbar **Branch** → type
`feature/login-page` → tick *"Checkout new branch"* → **Create Branch**.

Confirm where you are:

```powershell
git branch --show-current
```

### Step 3 — Do the work

Write code. Before committing, check your own work:

```powershell
# in frontend/
npm run lint
npm run format
npm run build

# in backend/
uv run ruff check .
uv run ruff format .
uv run pytest
```

Fix anything these complain about before you push. It is much cheaper than
having a reviewer point it out.

### Step 4 — Commit

**Terminal**

```powershell
git status
git add .
git status
git commit -m "feat(auth): add login form with email and password fields"
```

Run `git status` **before and after** `git add`. You are checking that no
`.env`, `node_modules/`, `.venv/` or build output is being committed. If you see
any of those, stop and tell the team — `.gitignore` needs fixing.

To stage only some files:

```powershell
git add frontend/src/features/auth/LoginForm.jsx
```

**SourceTree**

Left panel → **File Status**. Unstaged files are listed at the bottom. Tick the
files you want (or **Stage All**), type your message in the box, then
**Commit**.

SourceTree shows the diff for whatever file you click — read it before staging.
That is the cheapest bug-catching habit in this whole document.

#### Commit message format — Conventional Commits

```
<type>(<scope>): <what changed, imperative mood>
```

| Type | Use for |
|---|---|
| `feat` | new feature |
| `fix` | bug fix |
| `chore` | config, tooling, dependencies |
| `docs` | documentation |
| `refactor` | restructuring, behaviour unchanged |
| `test` | tests |
| `style` | formatting only, no logic change |

Scope is the area touched: `auth`, `jobs`, `frontend`, `backend`, `referrals`.
It is optional but helpful.

Good:

```
feat(jobs): add context-aware CTAs to the job detail page
fix(auth): refresh the token before it expires instead of after
chore(backend): pin ESLint to 9.x for plugin compatibility
docs: explain that .env is not updated by git pull
```

Bad:

```
update            (what?)
fixed stuff       (which stuff?)
asdf              (please no)
Added login page  (past tense, no type)
```

Write the subject line under ~72 characters. If you need more, add a blank line
and a body explaining **why**, not what — the diff already shows what.

### Step 5 — Push

**Terminal**

```powershell
git push -u origin feature/login-page
```

`-u` is only needed the **first** push of a new branch. After that, plain
`git push`.

**SourceTree**

Toolbar **Push** → tick your branch → **Push**.

### Step 6 — Open a pull request

Pull requests live on GitHub. SourceTree cannot create one — its
`Repository → Create Pull Request…` just opens the right GitHub page for you.

**On GitHub**

1. Open <https://github.com/patronfyp/patron>
2. **Pull requests** tab → **New pull request**
3. Set the two dropdowns:

```
base: [ develop ▾ ]   ←   compare: [ feature/login-page ▾ ]
```

Read it as: *"put the **compare** branch into the **base** branch."*

| What you are doing | base | compare |
|---|---|---|
| merging your feature | `develop` | `feature/...` |
| releasing | `main` | `develop` |

> Getting these backwards is the most common mistake. If you accidentally target
> `main`, the PR will sit blocked waiting for an approval it does not need —
> just edit the PR and change the base.

4. Scroll the diff below the dropdowns and actually look at it. This is your own
   last review before anyone else sees it.
5. **Create pull request**
6. Write the title and description, then **Create pull request** again.

#### PR title

Same format as a commit message:

```
feat(auth): add login form with email and password fields
```

GitHub pre-fills the branch name — replace it. `Develop` is not a title.

#### PR description template

```markdown
## What
One or two sentences on what this adds or changes.

## Why
Which module or issue this belongs to. e.g. "Module 1.2 - Email/Password Fallback"

## How
- key files added or changed
- any decision worth explaining, and the reason

## Verified
- [ ] lint clean
- [ ] build passes
- [ ] tested manually in the browser / via /docs

## Notes
Anything the reviewer should look at closely, or anything left unfinished.
```

A good description is not bureaucracy. It means the reviewer does not have to
reverse-engineer 30 files, and it becomes part of the project's written record —
useful when the supervisor asks how a feature was built.

7. Request a reviewer: right sidebar → **Reviewers** → gear icon → pick someone.

---

## 4. Reviewing someone else's PR

Every PR needs one approval from another team member. Never approve your own.

1. Open the PR. Read the **Conversation** tab first — the description tells you
   what to expect.
2. **Commits** tab — check the commits are sensibly named and that unrelated
   work has not been mixed in.
3. **Files changed** tab — this is the actual review.

Reading a diff:

| Colour | Meaning |
|---|---|
| green, `+` | line added |
| red, `-` | line removed |
| grey | unchanged context |

Tick the **Viewed** checkbox on each file as you finish it, so you can keep
track across a large PR.

### What to look for

| Check | Why |
|---|---|
| No `.env`, `.env.local`, `node_modules/`, `.venv/` in the file list | secrets and junk must never be committed |
| No password, token or API key hard-coded anywhere | same |
| Does the code do what the description says? | descriptions drift from reality |
| Names say what things are | `d`, `tmp2`, `handleThing` cost everyone time later |
| Any duplicated logic that belongs in `shared/` or `core/` | duplication is where bugs hide |
| Is there an obvious missing error case? | empty list, failed request, missing field |
| Does a schema change come with a migration? | otherwise everyone else's database breaks |

### Leaving a comment on a specific line

Hover the line number in **Files changed** → click the blue **+** → write the
comment → **Start a review** (not *Add single comment*, so all your comments are
submitted together).

### Submitting the review

**Files changed** tab → **Review changes** (top right) → pick one:

| Option | When |
|---|---|
| **Comment** | you have questions but are not blocking |
| **Approve** | the code is good to merge |
| **Request changes** | something must be fixed first |

Always write something — an empty approval is not a review, and the comment
becomes part of the project record. Say what you checked:

```
Pulled the branch and ran it locally - login form renders and validation fires
on empty submit. Checked no .env in the diff and no hard-coded secrets.

One question left inline about the error state. Otherwise looks good.

Approved.
```

### If changes were requested

The author fixes and pushes to the **same branch** — the PR updates itself. Do
not open a new PR.

```powershell
git add .
git commit -m "fix: address review comments"
git push
```

Note that a new push **dismisses the previous approval** on protected branches,
so the reviewer has to look again. That is intentional.

Reply to each comment and click **Resolve conversation** once handled. On
`main`, unresolved conversations block the merge.

---

## 5. Merging and cleaning up

Once approved, the author merges.

**On GitHub:** click the **▾** next to the green button → **Squash and merge**
→ **Confirm squash and merge**.

We use squash only. Your fifteen commits (`wip`, `fix typo`, `oops`) become one
clean commit on `develop`, and the PR number is appended automatically — so
`git log` stays readable and every commit links back to its discussion.

### Clean up afterwards

**Terminal**

```powershell
git checkout develop
git pull
git branch -d feature/login-page
git push origin --delete feature/login-page
```

**SourceTree**

Double-click `develop` → **Pull** → right-click your feature branch →
**Delete** (tick *"Delete remote branch"* if offered).

> ⚠️ Never delete `main` or `develop`. After merging a release PR, GitHub offers
> a **Delete branch** button — if the head branch was `develop`, **ignore it**.

---

## 6. When things go wrong

### "the branch is not fully merged"

```
error: the branch 'feature/x' is not fully merged
hint: If you are sure you want to delete it, run 'git branch -D feature/x'
```

**Expected after a squash merge.** Squashing creates a *new* commit on
`develop`, so your original commit is not an ancestor of `develop` and Git
cannot prove the branch was merged. The code is there; the hash is not.

Confirm nothing is lost, then force-delete:

```powershell
git diff develop feature/x --stat     # empty output = identical content
git branch -D feature/x
```

In SourceTree: right-click the branch → **Delete** → tick **Force delete**.

### Merge conflicts

Someone changed the same lines you did. Get the latest `develop` into your
branch and resolve:

```powershell
git checkout develop
git pull
git checkout feature/x
git merge develop
```

Git marks conflicts in the file:

```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> develop
```

Open each conflicted file, keep the correct result, delete all three marker
lines, then:

```powershell
git add .
git commit -m "chore: merge develop into feature/x"
git push
```

**SourceTree** lists conflicted files with a warning icon in File Status;
right-click → **Resolve Conflicts** for a side-by-side view.

Prevention: pull `develop` often, and keep PRs small.

### I committed on the wrong branch

Nothing pushed yet? Move the commit:

```powershell
git branch feature/correct-name        # bookmark the commit
git reset --hard HEAD~1                # remove it from the current branch
git checkout feature/correct-name
```

`reset --hard` throws away uncommitted work. Commit or stash first.

### I committed a secret

Stop and tell the team immediately. Do not just delete the file in a new commit
— it stays in history.

1. Rotate the credential right away (change the password / regenerate the key).
   Assume it is compromised.
2. Then ask for help rewriting history if the commit was already pushed.

### Wrong PR base branch

Open the PR → click **Edit** next to the title → change the base dropdown →
save. No need to close and reopen.

### I need to switch branches but have unfinished work

```powershell
git stash            # set changes aside
git checkout other-branch
# ...later...
git checkout feature/x
git stash pop        # bring them back
```

SourceTree: toolbar **Stash**, and the **STASHES** section in the left panel.

### I want to throw away my local changes

```powershell
git restore <file>     # one file
git restore .          # everything unstaged
```

This is not undoable. Be sure.

---

## 7. Quick reference

| Task | Terminal | SourceTree |
|---|---|---|
| Which branch am I on | `git branch --show-current` | bold branch in sidebar |
| Switch branch | `git checkout <branch>` | double-click branch |
| New branch | `git checkout -b feature/x` | toolbar **Branch** |
| Get latest | `git pull` | toolbar **Pull** |
| What changed | `git status` | **File Status** |
| See a diff | `git diff` | click a file in File Status |
| Stage | `git add .` | tick files / **Stage All** |
| Commit | `git commit -m "..."` | toolbar **Commit** |
| Push | `git push` | toolbar **Push** |
| History | `git log --oneline --graph` | **History** |
| Set work aside | `git stash` | toolbar **Stash** |
| Discard changes | `git restore .` | toolbar **Discard** |
| Delete branch | `git branch -d <branch>` | right-click → **Delete** |
| Force delete | `git branch -D <branch>` | **Delete** → **Force delete** |
| Remove stale remote branches | `git fetch --prune` | **Fetch** → tick *Prune tracking branches* |

---

## 8. Rules

1. Never push directly to `main` or `develop`.
2. Never commit `.env`, `.env.local`, `node_modules/` or `.venv/`.
3. Always `git pull` on `develop` before creating a branch.
4. One PR = one piece of work. Don't bundle five unrelated changes.
5. Never approve your own PR.
6. Run lint, format and build before you push.
7. Reply to review comments — don't leave them hanging.
8. Never change the database schema by hand; write a migration.
9. Merge with **Squash and merge**, always.
10. Delete your feature branch after it merges.

# Architecture Decision Records

One file per decision, recording what was decided and why. See
`docs/DOCUMENTATION_GUIDE.md` §4 for the template and numbering rules.
Numbers are never reused — see the numbering note on ADR 0010 for why 0010,
0011 and 0013 are not the numbers originally planned for them in #24.

## Index

| # | Decision | Decided by |
|---|---|---|
| [0001](0001-monorepo-over-two-repos.md) | Monorepo over two repositories | Rafay |
| [0002](0002-javascript-over-typescript.md) | JavaScript over TypeScript | Rafay |
| [0003](0003-antd-over-tailwind.md) | Ant Design over Tailwind or MUI | Rafay |
| [0004](0004-eslint-pinned-to-9.md) | Pin ESLint to 9.x | Rafay |
| [0005](0005-uv-over-pip-or-poetry.md) | uv over pip or Poetry | Rafay |
| [0006](0006-react-query-and-zustand-over-redux.md) | React Query + zustand — Redux rejected | Rafay |
| [0007](0007-referrals-and-recommendations-as-separate-tables.md) | Referrals and Recommendations as separate tables | Rafay |
| [0008](0008-snake-case-in-json-payloads.md) | snake_case in JSON payloads | Rafay |
| [0009](0009-access-token-in-memory-refresh-token-in-localstorage.md) | Access token in memory, refresh token in localStorage | Rohan |
| [0010](0010-separate-user-identities-table-for-multi-provider-auth.md) | Separate `user_identities` table for multi-provider auth | Rafay |
| [0011](0011-account-linking-only-on-verified-email.md) | Account linking only on a provider-verified email | Rafay |
| [0012](0012-visual-design-language-for-hero-screens.md) | Visual design language for hero screens | Rafay |
| [0013](0013-linkedin-self-serve-scopes-only.md) | LinkedIn self-serve scopes only — Modules 1.1 and 2.9 rescoped | Rafay |
| [0014](0014-no-pkce-for-linkedin-oauth.md) | No PKCE for LinkedIn sign-in | Rafay |

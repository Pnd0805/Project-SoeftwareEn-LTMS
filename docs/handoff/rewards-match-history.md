# Rewards + Match History Handoff

## Context

This branch implements the two assigned Sprint/Future items:

1. Badge / Achievement
2. Detailed Participation History

Primary sources used for the implementation:

- `SDS Ver.2 (1).pdf`
- Sprint/Future feature screenshot in the local `todo` workspace
- Existing schema and implementation in `origin/BE_KN`

Implementation branch:

```text
feat/rewards-match-history
```

Base used when the worktree was created:

```text
origin/BE_KN @ 09f3043
```

Main implementation commit:

```text
ffe8c47 feat: add rewards profile API and match history
```

---

## 1. Badge / Achievement

### What the SDS already defines

The database design already contains the reward foundation:

- `rewards`
- `user_rewards`
- `point_transactions`
- `users.total_points`

`rewards` defines fields including:

- `reward_type`
- `name`
- `description`
- `points_required`
- `criteria`
- `icon_key`
- `is_active`

`user_rewards` defines earned rewards and includes `is_displayed`, which is intended to control whether the reward is shown on the user's public profile.

### Implemented in this branch

Public reward catalogue:

```http
GET /api/v1/rewards
```

Public rewards displayed by a user:

```http
GET /api/v1/users/:id/rewards
```

All rewards earned by the authenticated user, including hidden rewards:

```http
GET /api/v1/me/rewards
```

Show or hide an earned reward on the public profile:

```http
PATCH /api/v1/me/rewards/:id/display
Content-Type: application/json

{
  "isDisplayed": true
}
```

An internal `grantReward(userId, rewardId)` service primitive was also added for future automatic-award logic. Granting is idempotent because the database already enforces uniqueness for `(user_id, reward_id)` and the repository uses an idempotent insert.

### Decisions made

The first version intentionally implements the reward infrastructure and profile-display behaviour, but does not invent a badge catalogue or automatic rules that are not specified by the source material.

Therefore this branch does **not** hard-code achievements such as:

- First Tournament
- Champion
- Win 10 Matches
- MVP awards
- Pick'em streaks

Those can be added later by connecting rule evaluators to the existing `grantReward()` primitive.

### Intentionally deferred

Automatic badge/achievement criteria are not implemented yet because the SDS does not define a concrete catalogue or exact trigger rules.

A redemption flow is also not implemented. The SDS currently has an internal inconsistency: `reward_type` is described as `badge | achievement`, while the description of `points_required` refers to `REDEEMABLE`. Because the source does not define that model consistently, this branch does not invent a redemption contract.

### Future extension point

Once the team agrees on concrete rules, the expected next step is to add evaluators/triggers that call:

```text
grantReward(userId, rewardId)
```

The existing reward endpoints and profile-display contract should not need to be redesigned for that extension.

---

## 2. Detailed Participation History

### What the SDS already defines

The SDS explicitly reserves the user endpoint:

```http
GET /users/{id}/match-history
```

This is identified as the detailed player history endpoint, separate from the already-existing career summary.

The current backend also already has:

```http
GET /api/v1/users/:id/career
```

which summarizes participation by tournament. That existing contract is intentionally left unchanged.

### Implemented in this branch

Detailed history endpoint:

```http
GET /api/v1/users/:id/match-history
```

Each history item contains the available detailed match information:

```text
matchId

tournament
  id
  name
  sportTypeId

team
  id
  name

opponent
  id
  name

roundNumber
scheduledTime
startedAt
playedAt
venue
mode
scoreData
result
playerStats[]
```

`result` is returned as `win` or `loss` when a winner exists.

`playerStats[]` uses the actual sport-stat definitions and values stored for that user in that match, including fields such as the stat key, Thai label, and value.

### Participation rules

The endpoint is deliberately stricter than simply checking whether the user was listed in a tournament application.

A match is included only when:

- the tournament application was approved;
- the match result is `verified`;
- the tournament is not soft-deleted; and
- there is evidence that the user actually participated in the match, through either a successful/exception check-in or recorded player-match statistics.

This prevents roster-only players who never actually played from automatically appearing in detailed match history.

Matches are returned newest first.

### Relationship with `/career`

The two endpoints have different purposes:

```text
GET /users/:id/career
    -> tournament-level summary

GET /users/:id/match-history
    -> detailed match-level participation history
```

The existing `/career` contract was not expanded or replaced so that current consumers remain compatible.

---

## Verification

The implementation was verified with:

```text
Targeted new tests: 15 / 15 passed
Full backend Vitest suite: 2471 / 2471 passed
Production TypeScript build: PASS
git diff --check: PASS
```

`npm run typecheck` for the entire repository still reports existing type errors in older test fixtures. Those errors predate this feature work and do not block the production build.

A live database HTTP smoke test could not be completed in the same verification pass because Docker Desktop/MySQL was not running at that moment. Repository, service, mapper, build, and full Vitest coverage for the branch all passed.

---

## Open Questions for the Team

The implementation can be extended later when the team decides these product rules:

- What exact badges/achievements exist?
- What are the exact criteria for each reward?
- Which rewards are automatic versus point-based/redeemable?
- What should the canonical meaning of `points_required` be?
- Does detailed match history need any additional fields beyond the current match/team/opponent/result/stat data?

Until those rules are agreed, this branch intentionally keeps the implementation conservative and does not invent product behaviour that is not specified by the project sources.

---

## Encoding review and repair (2026-10-01)

Following the team's `TO-TEAM-2026-10-01-encoding.md` review, the branch was repaired before merge:

- Restored `backend/src/routes/index.ts` from the base commit and reapplied **only** the two intended imports and four router mounts; other developers' Thai comments are preserved.
- Re-entered damaged Thai text in five newly added files, including `AppError` messages, `parseId` field labels and test fixture labels.
- Removed accidental UTF-8 BOM bytes from all 19 originally changed files. Added tracked `.editorconfig` declaring UTF-8. Editors must read and save UTF-8; this repository ignores `.vscode/`, so each VS Code user should set `files.encoding` to `utf8` and `files.autoGuessEncoding` to `false` locally.
- Reward service tests now assert the Thai user-facing error messages to catch future text corruption. Production build and full 2,471-test suite passed again after the repair.

**Access policy to confirm:** `GET /users/:id/match-history` currently remains public, matching the first implementation's intended public profile/history use. The team should explicitly decide whether it needs authentication or other visibility restrictions before merge. No authorization behaviour was changed as part of the encoding repair.

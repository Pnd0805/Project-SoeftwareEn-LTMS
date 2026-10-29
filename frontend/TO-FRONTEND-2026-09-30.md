# For the frontend team — `BE_KN@2f072e7` and what it needs from us (2026-09-30)

Frontend branch `feat/1` · backend `BE_KN` pulled to `2f072e7`, migrations 031 and
032 applied. Two items we had been waiting on arrived and **both were verified
against the live server** (38 checks). Neither has a screen yet. This file is
everything needed to build them; the backend's side is in
`TO-BACKEND-2026-09-30.md`.

---

## 0. Set up once, on every machine

```bash
cd C:/Users/DELL/Projects/ltms-backend-shokun2 && git pull origin BE_KN
```

```bash
cd C:/Users/DELL/Projects/ltms-backend-shokun2/backend && npm run migrate
```

```bash
cd C:/Users/DELL/Projects/ltms-backend-shokun2/backend && docker compose up --no-deps minio-init
```

**The third command is the one people will miss.** A `ltms-minio` created before
this pull never got the public-read policy for `avatar/` and `team_logo/`. Every
avatar and logo URL then answers **403** although the API is correct — it will
look like our `<img>` is broken. The command only sets the two policies; it does
not recreate MinIO or lose files. The four private folders stay 403, as they
should.

To reset test data, use the wrapper; it works with 032:

```bash
python C:/Users/DELL/Projects/Project-SoeftwareEn-LTMS/frontend/scripts/restore-qa.py
```

---

## 1. Dismissing a comment report

**Owner:** slice 2 (`features/tournament/LiveCommunityTab.tsx`), with the API in
`api/liveEngagement.ts` / `hooks/useLiveEngagement.ts`.

### Contract (verified)

| | |
|---|---|
| Route | `POST /tournaments/:id/comments/:cid/dismiss`, no body |
| Success | `200 {id, isReported: false}` — the comment stays, it leaves `?reported=true` |
| Who | **the tournament's organizer only** (see the gap below) |
| Errors | `409 FEEDBACK_NOT_REPORTED` (already cleared or never reported) · `403 NOT_ORGANIZER` · `404 FEEDBACK_NOT_FOUND` |
| New DTO field | `reportCleared: boolean` on E14 comment items, **moderators only**, beside `isReported` |
| Side effects | audit `comment_report_dismissed`; **no** notification to the author |

Behaviour worth knowing when you test it:

- **Reporting again after a dismiss** still answers `{isReported: true}`, so the
  reporter can't tell. But the comment does **not** re-enter the queue, and the
  organizer is not notified again.
- **When the author edits the comment**, the clearance is dropped, so a new report
  puts it back in the queue.

### What to build

- [ ] `dismissComment(tournamentId, commentId)` in `api/liveEngagement.ts`, and a
      `dismiss` mutation beside `report` / `moderate` in `useCommentsLive`
      (refresh the same query).
- [ ] Add `reportCleared?: boolean` to the comment type in
      `types/liveEngagement.dto.ts`.
- [ ] In the **Reported only** view, a **Dismiss** button next to Remove.
  - Show it only when the viewer is the organizer: `me.id` equals the
    tournament's `requestedByUserId`. **Not** on `canModerate` alone — a
    university-wide admin also gets `canModerate: true` and would get 403. We
    have asked the backend to either admit admins or send a `canDismiss` flag;
    switch to that when it lands.
  - Read `409 FEEDBACK_NOT_REPORTED` as "Already cleared — refreshing", then
    refetch.
- [ ] Show a small **Reviewed** badge on comments where `reportCleared` is true,
      so the organizer doesn't re-read them.
- [ ] (Suggested on 29 Sep, still open) Hide **Report** when `canModerate` is
      true. The organizer can Remove or Dismiss directly; their own Report
      button only creates misclicks.

---

## 2. Avatar and team-logo uploads (R23)

**Owners:**

- Avatar on the profile: Person 1 (`features/profile`).
- Team logo: slice 4 (`features/team/TeamManage.tsx`).
- The shared API: whoever takes it first. Say so in the team chat.

### Contract (verified)

The flow is presign → PUT → PATCH.

1. **Presign:**
   ```
   POST /uploads/presign {purpose, contentType, teamId?}
   → 200 {uploadUrl, objectKey, expiresIn}
   ```
   - `purpose`: `"avatar"` (always the caller's own user) or `"team_logo"`
     (`teamId` required, **team leader only**).
   - `contentType`: `"image/jpeg"` or `"image/png"` only.
2. **Upload:** `PUT uploadUrl` with the file, and a `Content-Type` header matching
   the one you presigned.
3. **Save:**
   - `PATCH /me {avatarUrl: objectKey}` → the user DTO's `avatarUrl` is now a
     **full URL**.
   - `PATCH /teams/:id {logoKey: objectKey}` → the team DTO has `logoUrl`.
   - Send `null` to remove either one.

The backend says every DTO that carries a person now returns a readable
`avatarUrl` instead of a raw S3 key (the 14 places we reported). We checked
`PATCH /me` and `GET /users/:id`; confirm others as you wire them.

| Error | When |
|---|---|
| `400 UNSUPPORTED_FILE_TYPE` | any type other than JPEG/PNG (checked with GIF) |
| `400 VALIDATION_FAILED` | `team_logo` without `teamId` |
| `403 NOT_TEAM_LEADER` | a team member who is not the leader asks for a logo upload |
| `404 TEAM_NOT_FOUND` | unknown team |
| `422 AVATAR_KEY_INVALID` / `TEAM_LOGO_KEY_INVALID` | the key belongs to someone else or another team |
| `422 AVATAR_KEY_NOT_FOUND` / `TEAM_LOGO_KEY_NOT_FOUND` | nothing was uploaded under that key — ask for a re-upload |
| `503 STORAGE_UNAVAILABLE` | MinIO unreachable |

### What to build

- [ ] Shared API: `presignImage(purpose, contentType, teamId?)` → `putToStorage(uploadUrl, file)`,
      reusing the check-in upload's PUT in `api/match.ts` (purpose
      `checkin_document`) as the pattern.
- [ ] **Profile (Person 1):**
  - Choose a picture → preview → Save calls `PATCH /me`.
  - A Remove option sends `null`.
  - The Shell avatar already renders `avatarUrl` when present.
- [ ] **Team (slice 4, `TeamManage.tsx`):**
  - Offer logo upload to the leader only.
  - Save calls `PATCH /teams/:id {logoKey}`; Remove sends `null`.
- [ ] **Map `logoUrl` through.** `components/kit/chips.tsx` already renders
      `logoUrl`, but our API mappers still hard-code `logoUrl: null` (e.g.
      `api/match.ts:154`). Read it from the team DTOs so logos appear in chips,
      brackets and match pages.
- [ ] Reject files other than JPEG/PNG before presigning, and say why. The
      backend's size limit was not tested; keep the picker's limit modest until
      it is known.

---

## 3. Carried over (unchanged)

- **Slice 2:**
  - Round-robin tournaments have no Draw tab, so the per-match referee planner
    never renders for them (`ManageTab.tsx`, `showDraw`).
  - `SetupTrail.tsx` step 6 now counts referees (`e172196`); please review it,
    since the file is yours.
- **Slice 3:** match 12 shows "Entered by —" with no submitter name (R41).
- **Person 1:** the `finished` badge label, and the per-match MVP page.
- **Admin access check.** It must move to `adminScope` from `GET /me` **before**
  the backend makes root's tournament-request queue answer 403; otherwise root
  is locked out of the Admin page.
- `/me/teams` still returns deleted teams. That's backend-side, due 1–2 Oct.
  Until then, expect QA teams that open nothing but 404s.

Test accounts: everything is `abcd1234`.

| Account | Useful for |
|---|---|
| `somchai@ku.th` | organizer of t19; dismiss works for him there |
| `admin.eng@ku.th` | faculty 1 admin |
| `p9201@ku.th` | leader of team 9023; logo upload works for him |
| `mana@ku.th` | member of team 9020 but not its leader; logo upload is refused |
| `playerA1@ku.th` | reports a comment |

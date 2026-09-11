# Backend Test Suite — Complete Test List

Extracted directly from the test files (not summarized from memory) — this is
every single test case, exactly as written, grouped by file. **326 tests total.**

---

## Middleware (5 files, 27 tests)

### `requireAuth.test.ts` (7)
1. calls next with NO_TOKEN when Authorization header is missing
2. calls next with NO_TOKEN when the scheme is not "Bearer"
3. calls next with NO_TOKEN when "Bearer" has no token after it
4. rejects (does not call next) when verifyToken throws for an invalid/expired token
5. calls next with USER_NOT_FOUND when the token is valid but the user no longer exists
6. calls next with ACCOUNT_SUSPENDED when the user is suspended
7. attaches req.user and calls next() with no error for a valid, active user

### `requireTeamLeader.test.ts` (5)
1. calls next with TEAM_NOT_FOUND when the team does not exist
2. calls next with USER_NOT_FOUND when req.user is not set
3. calls next with NOT_TEAM_LEADER when the user is not the leader of the team
4. attaches req.team and calls next() with no error when the user is the leader
5. converts req.params.id to a number before querying the repo

### `validate.test.ts` (5)
1. calls next() with no error and replaces req.body with parsed data on success
2. calls next with a single-field VALIDATION_FAILED AppError when one field is invalid
3. collects one message per field when multiple fields are invalid
4. reports a missing required field under its own key
5. does not mutate req.body when validation fails

### `errorHandler.test.ts` (7)
1. responds with the AppError's own status code and error body
2. spreads err.extra into the error body (e.g. field-level validation errors)
3. does not error when extra is undefined (no spread crash)
4. never calls next() — it always terminates the response itself
5. responds 500 with a generic INTERNAL_ERROR body, hiding the real message
6. logs the original error server-side via console.error
7. never calls next() for unexpected errors either

### `notFound.test.ts` (2)
1. calls next with a 404 NOT_FOUND AppError for any unmatched route
2. never touches res directly — it always defers to errorHandler via next()

---

## Services (4 files, 42 tests)

### `auth.service.test.ts` (8)
1. registers a new user successfully
2. throws EMAIL_ALREADY_REGISTERED when the email is already in use
3. throws VALIDATION_FAILED with facultyId field when faculty does not exist
4. throws VALIDATION_FAILED with departmentId field when department is not in the faculty
5. logs in successfully and returns an access token
6. throws INVALID_CREDENTIALS when the user does not exist
7. throws INVALID_CREDENTIALS when the password is wrong
8. throws ACCOUNT_SUSPENDED when the account is suspended

### `team.service.test.ts` (14)
1. creates a team when sport exists, name is free, and quota is not exceeded
2. throws VALIDATION_FAILED when the sport type does not exist
3. throws TEAM_NAME_TAKEN when a team with the same name/sport exists
4. throws TEAM_QUOTA_EXCEEDED when the leader already has 5 unofficial teams
5. maps every team the user belongs to, including its member count
6. returns an empty items array when the user has no teams
7. returns a team DTO when the team and its leader both exist
8. throws USER_NOT_FOUND when the leader referenced by the team no longer exists
9. updates and returns the refreshed team when the new name is free
10. allows renaming a team to its own current name (same team_id)
11. throws TEAM_NAME_TAKEN when renaming to a name used by a different team
12. skips the name-uniqueness check entirely when name is not part of the update
13. soft-deletes a team that is not already deleted
14. throws TEAM_NOT_FOUND when the team is already soft-deleted

### `user.service.test.ts` (12)
1. returns a public user DTO including mapped team refs
2. propagates the error from checkUser without querying teams
3. returns an empty team list when the user is on no teams
4. returns stats for an existing user
5. propagates the error from checkUser without querying stats
6. throws QUERY_TOO_SHORT for queries under 3 characters
7. rejects an empty query as too short
8. returns mapped results for a valid query
9. returns an empty items array when no users match
10. accepts a query exactly 3 characters long (boundary case)
11. updates the user then returns the refreshed "me" DTO
12. calls update before re-fetching the user (correct ordering)

### `reference.service.test.ts` (8)
1. returns every faculty mapped to a DTO
2. returns an empty items array when there are no faculties
3. returns mapped departments when the faculty exists
4. throws FACULTY_NOT_FOUND when the faculty does not exist
5. returns every sport type mapped to a DTO
6. returns an empty items array when there are no sport types
7. returns mapped stat definitions when the sport type exists
8. throws SPORT_TYPE_NOT_FOUND when the sport type does not exist

---

## Controllers (8 files, 83 tests)

### `auth.controller.test.ts` (5)
1. registers and responds 201 with the service result
2. propagates (rejects with) the error when the service throws (register)
3. logs in with email/password from the body and responds 200 with the result
4. propagates (rejects with) the error when credentials are invalid (login)
5. responds 204 with no body and does not call the auth service (logout)

### `team.controller.test.ts` (19)
1. creates a team for the authenticated user and responds 201
2. propagates the error when the service throws (createTeam)
3. fetches the authenticated user's teams and responds 200 (getMyTeam)
4. converts the route param to a number and responds 200 with the team (getTeamById)
5. propagates the error when the team is not found (getTeamById)
6. throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing (updateTeamById)
7. updates the team using fields from req.team and responds 200
8. throws TEAM_NOT_FOUND immediately (before touching res) when req.team is missing (deleteTeamById)
9. deletes the team from req.team and responds 204 with no body
10. fetches the member using the route id and the authenticated user id, responds 200 (getTeamMember)
11. propagates the error when the service throws (getTeamMember)
12. parses team id and user id from the route and responds 200 with the update result (updateTeamMember)
13. propagates the error and never calls the service when parseId fails on the team id (updateTeamMember)
14. throws FORBIDDEN before calling the service when the target user is the team leader (deleteMember)
15. deletes a non-leader member and responds 204 with no body (deleteMember)
16. parses the team id and creates the invitation, responds 201 (createTeamInvitation)
17. parses the team id and responds 200 with the invitation list (getAllInvitation)
18. parses the team id and invite id, deletes, and responds 204 with no body (deletePendingInvite)
19. parses the team id and creates an official request, responds 201 (createTeamOfficialRequest)

### `user.controller.test.ts` (13)
1. throws USER_NOT_FOUND before touching res when req.user is missing (getMe)
2. maps req.user with toMeDto and responds 200 (getMe)
3. parses the id param and responds 200 with the service result (getUserById)
4. propagates the error when parseId rejects a malformed id
5. parses the id param and responds 200 with the stats (getUserStats)
6. throws QUERY_TOO_SHORT before touching res when q is missing from the query (searchUser)
7. throws QUERY_TOO_SHORT when q is not a string (e.g. an array from ?q=a&q=b)
8. searches with the query string and responds 200
9. throws USER_NOT_FOUND before touching res when req.user is missing (patchMe)
10. updates the authenticated user and responds 200 (patchMe)
11. fetches the authenticated user's invitations and responds 200 (getMyInvitation)
12. propagates the error when the service throws (getMyInvitation)
13. rejects with a TypeError (not an AppError) when req.user is missing, unlike getMe()/patchMe() — no guard clause exists on this endpoint

### `reference.controller.test.ts` (8)
1. responds 200 with every faculty from the service
2. propagates a service error (getAllFaculty)
3. parses the faculty id param and responds 200 with departments
4. propagates the error and never calls the service when parseId fails
5. propagates FACULTY_NOT_FOUND from the service
6. responds 200 with every sport type from the service
7. parses the sport type id param and responds 200 with stat definitions
8. propagates SPORT_TYPE_NOT_FOUND from the service

### `adminScope.controller.test.ts` (7)
1. parses pagination from the query and responds 200 with the service result (getAllOfficialRequest)
2. passes through undefined query params (pagination utility applies its own defaults)
3. propagates a service error (getAllOfficialRequest)
4. parses the request id and approves it as the acting admin, responds 200 (approveTeamOfficial)
5. propagates the error and never calls the service when parseId fails (approveTeamOfficial)
6. parses the request id and rejects it with a reason, responds 200 (rejectTeamOfficial)
7. propagates a service error, e.g. request already decided (rejectTeamOfficial)

### `application.controller.test.ts` (18)
1. parses the tournament id and responds 200 with approved teams (getTournamentTeams)
2. propagates the error and never calls the service when parseId fails (getTournamentTeams)
3. throws USER_NOT_FOUND before touching res when req.user is missing (getMyappication)
4. fetches the authenticated user's applications and responds 200 (getMyappication)
5. parses the tournament id and responds 200 with applications (getTournamentApplications)
6. throws USER_NOT_FOUND before touching res when req.user is missing (getApplicationDetail)
7. parses the application id and responds 200 with the detail (getApplicationDetail)
8. throws USER_NOT_FOUND before touching res when req.user is missing (cancelApplication)
9. parses the application id and cancels it, responds 200 (cancelApplication)
10. throws USER_NOT_FOUND before touching res when req.user is missing (withdrawApplication)
11. parses the application id and withdraws it, responds 200 (withdrawApplication)
12. throws USER_NOT_FOUND before touching res when req.user is missing (approveApplication)
13. parses the application id and approves it, responds 200 (approveApplication)
14. throws USER_NOT_FOUND before touching res when req.user is missing (rejectApplication)
15. parses the application id and rejects it with a reason, responds 200 (rejectApplication)
16. throws USER_NOT_FOUND before touching res when req.user is missing (applyTournament)
17. parses the tournament id, applies with the team from the body, and responds 201 (applyTournament)
18. propagates a service error, e.g. team already applied (applyTournament)

### `invitation.controller.test.ts` (5)
1. parses the invitation id and accepts it as the authenticated user, responds 200 (acceptInvitation)
2. propagates the error and never calls the service when parseId fails (acceptInvitation)
3. propagates a service error, e.g. invitation already decided (acceptInvitation)
4. parses the invitation id, rejects it, and responds 204 with no body (rejectInvitation)
5. propagates the error and never calls the service when parseId fails (rejectInvitation)

### `referee.controller.test.ts` (8)
1. parses the tournament id and invites a referee using the whole request body, responds 201 (invite)
2. propagates the error and never calls the service when parseId fails (invite)
3. parses the tournament id and responds 200 with the referee list (list)
4. fetches the authenticated user's referee invitations and responds 200 (listMyInvitations)
5. parses the invitation id and accepts it, responds 200 (accept)
6. propagates a service error, e.g. invitation already decided (accept)
7. parses the invitation id, declines it, and responds 204 with no body (decline)
8. propagates the error and never calls the service when parseId fails (decline)

---

## Mappers (4 files, 28 tests)

### `reference.mapper.test.ts` (5)
1. maps snake_case DB fields to camelCase DTO fields (toFacultyDto)
2. maps department_id, faculty_id, and name correctly (toDepartmentDto)
3. maps all fields including min/max member counts and default mode (toSportTypeDto)
4. preserves the "online" default mode value as-is
5. maps every field to its camelCase DTO equivalent (toSportStatDefinitionDto)

### `stat.mapper.test.ts` (6)
1. maps a single sport-stat row to its DTO shape (toSportStatDto)
2. returns zeroed-out overall stats and an empty bySport list for a user with no stats
3. sums matches/wins/losses/championships across multiple sports
4. computes winRate as wins / matchesPlayed for a single sport
5. avoids a divide-by-zero and reports winRate 0 when matchesPlayed is 0 across all rows
6. keeps userId as passed in, independent of the row data

### `team.mapper.test.ts` (10)
1. maps team_id, name, and sport_type_id (toTeamRef)
2. maps a freshly created team row, including leaderId and readinessStatus verbatim (toCreateTeam)
3. marks the role as "leader" when the viewing user is the team leader (toMyTeam)
4. marks the role as "member" when the viewing user is not the leader
5. reports the real readiness status when the team is not deleted (toMyTeam)
6. overrides readinessStatus to "Inactive" when the team is soft-deleted (toMyTeam)
7. passes memberCount through unchanged
8. maps a full team DTO including leader, memberCount, and ISO createdAt (toTeamDto)
9. overrides readinessStatus to "Inactive" when the team is soft-deleted (toTeamDto)
10. reports the real readiness status when the team is not deleted (toTeamDto)

### `user.mapper.test.ts` (7)
1. maps every field of a full user row, including nested notification prefs (toMeDto)
2. passes through null values for optional fields rather than defaulting them
3. maps only user_id, full_name, and profile_image_key (toUserRef)
4. maps a null avatar through as null rather than a placeholder string
5. maps the public-facing subset of user fields plus the provided team refs (toPublicUserDto)
6. does not leak private fields like email, contactInfo, or address
7. passes an empty teams array through unchanged

---

## Schemas (5 files, 77 tests)

### `application.schema.test.ts` (10)
1. accepts a non-empty reason string (rejectApplicationSchema)
2. rejects an empty reason string
3. rejects a missing reason field
4. rejects a non-string reason
5. accepts a positive integer teamId (applyTournamentSchema)
6. rejects teamId 0
7. rejects a negative teamId
8. rejects a decimal teamId
9. rejects a missing teamId
10. rejects a string teamId

### `auth.schema.test.ts` (26)
1. accepts a fully valid registration payload
2. rejects a fullName shorter than 2 characters
3. accepts the boundary value of exactly 2 characters
4. rejects a fullName longer than 100 characters
5. accepts the boundary value of exactly 100 characters
6. rejects a malformed email
7. accepts a well-formed email
8. rejects a password shorter than 8 characters even with a digit
9. rejects an 8+ character password with no digit
10. accepts a password with 8+ characters and at least one digit
11. accepts the boundary value of exactly 8 characters with a digit
12–14. accepts gender "male" / "female" / "other" (parameterized)
15. rejects a gender outside the allowed enum
16. accepts a valid YYYY-MM-DD date string
17. rejects a date in the wrong format (e.g. DD/MM/YYYY)
18. rejects a full ISO datetime string (with time component)
19. rejects facultyId 0
20. rejects a negative departmentId
21. rejects a decimal year
22. rejects year 0
23. accepts a valid email with any non-empty password (loginSchema)
24. accepts an empty password (login has no length/complexity rule)
25. rejects a malformed email (loginSchema)
26. rejects a missing password field

### `referee.schema.test.ts` (8)
1. accepts a valid userId with isExternal true
2. accepts a valid userId with isExternal false
3. rejects userId 0
4. rejects a negative userId
5. rejects a decimal userId
6. rejects a missing isExternal field
7. rejects a non-boolean isExternal value
8. rejects a missing userId field

### `team.schema.test.ts` (26)
1. accepts a valid name and sportTypeId (teamSchema)
2. rejects an empty name
3. rejects a missing name
4. rejects sportTypeId 0
5. rejects a negative sportTypeId
6. rejects a decimal sportTypeId
7. accepts a valid non-empty name (updateTeamSchema)
8. accepts an empty object since name is optional
9. rejects an empty string name when the field is provided
10–11. accepts position "starter" / "substitute" (updateMemberschema, parameterized)
12. rejects a position outside the allowed enum
13. rejects a missing position field
14. accepts a positive integer invitedUserId (createTeamInvitedSchema)
15. rejects invitedUserId 0
16. rejects a negative invitedUserId
17. rejects a decimal invitedUserId
18. accepts an array of strings (requestSchema)
19. accepts an empty array
20. rejects an array containing a non-string element
21. rejects a missing supportingDocs field
22. rejects supportingDocs that is not an array
23. accepts a non-empty reason string (rejectTeamOfficial)
24. accepts an empty string — schema has no min-length rule, only a custom type-error message
25. rejects a missing reason field
26. rejects a non-string reason

### `user.schema.test.ts` (7)
1. accepts an empty object since every field is optional
2. accepts all fields provided as strings
3. accepts a subset of fields
4. rejects avatarUrl when it is not a string
5. rejects contactInfo when it is not a string
6. rejects address when it is not a string
7. ignores unrelated extra keys without validation error by default zod behavior

---

## Utils (6 files, 69 tests)

### `password.test.ts` (6)
1. returns a bcrypt hash string, not the plaintext password
2. produces a different hash each time for the same input (random salt)
3. returns true when the plaintext matches the hash it was generated from
4. returns false when the plaintext does not match the hash
5. is case-sensitive
6. returns false (not a thrown error) for an empty password against a real hash

### `token.test.ts` (10)
1. produces a well-formed JWT (three dot-separated segments)
2. stringifies the numeric userId into the "sub" claim
3. sets an expiry in the future based on authConfig.expireIn
4. returns the sub claim for a token signed by signToken itself
5. throws TOKEN_EXPIRED for a garbage/malformed token string
6. throws TOKEN_EXPIRED for a token signed with the wrong secret
7. throws TOKEN_EXPIRED for an actually-expired token
8. throws TOKEN_EXPIRED when the payload is a plain string rather than an object
9. throws TOKEN_EXPIRED when sub is present but not a string
10. throws TOKEN_EXPIRED when sub is missing entirely

### `checkExist.test.ts` (6)
1. returns the user row when the user exists (checkUser)
2. throws USER_NOT_FOUND when the user does not exist
3. throws an AppError instance, not a plain Error
4. returns the team row when the team exists (checkTeam)
5. throws TEAM_NOT_FOUND when the team does not exist
6. does not treat a soft-deleted team (deleted_at set) as non-existent

### `parseId.test.ts` (14)
1. parses a numeric string into a number
2. accepts the boundary value 1 (smallest valid positive integer)
3. trims incidental whitespace the way Number() does
4. parses large integer strings correctly
5. rejects 0 (not a positive integer)
6. rejects negative numbers
7. rejects non-integer (decimal) values
8. rejects non-numeric strings
9. rejects undefined (id param missing entirely)
10. rejects an array (e.g. a duplicated route param like /users/1/2)
11. rejects an empty string
12. throws with status 400 and code VALIDATION_FAILED
13. defaults the error field key to "id" when no field name is given
14. uses the custom field name when provided (e.g. "facultyId")

### `pagination.test.ts` (25)
1. parses a valid numeric string page
2. defaults to page 1 when page is undefined
3. defaults to page 1 when page is 0
4. defaults to page 1 when page is negative
5. defaults to page 1 when page is a decimal
6. defaults to page 1 when page is non-numeric
7. defaults to page 1 when page is an array (duplicated query param)
8. parses a valid numeric string pageSize
9. defaults to pageSize 20 when pageSize is undefined
10. defaults to pageSize 20 when pageSize is 0
11. defaults to pageSize 20 when pageSize is negative
12. defaults to pageSize 20 when pageSize is a decimal
13. defaults to pageSize 20 when pageSize is non-numeric
14. caps pageSize at 100 when a larger valid value is given
15. accepts the boundary value 100 without capping further
16. accepts the boundary value 1 (smallest valid pageSize)
17. computes offset 0 for page 1
18. computes offset correctly for page > 1
19. computes offset correctly with a custom pageSize
20. computes offset 0 when both page and pageSize fall back to defaults
21. returns the page, pageSize, and totalItems unchanged (buildPagination)
22. rounds totalPages up when totalItems does not divide evenly
23. computes totalPages exactly when totalItems divides evenly
24. returns totalPages 0 when totalItems is 0
25. returns totalPages 1 when totalItems is less than pageSize

### `AppError.test.ts` (9)
1. sets status, code, and message from the constructor args
2. sets extra when provided
3. defaults extra to undefined when omitted
4. is an instance of both AppError and the native Error
5. sets the name property (inherited from Error) as expected
6. produces a readable stack trace
7. can be thrown and caught like a normal Error
8. exposes message via String(err) the same way a native Error does
9. does not share extra between separate instances

---

## Verified totals

| Layer | Files | Tests |
|---|---|---|
| Middleware | requireAuth, requireTeamLeader, validate, errorHandler, notFound | 27 |
| Services | auth, team, user, reference | 42 |
| Controllers | auth, team, user, reference, adminScope, application, invitation, referee | 83 |
| Mappers | reference, stat, team, user | 28 |
| Schemas | application, auth, referee, team, user | 77 |
| Utils | password, token, checkExist, parseId, pagination, AppError | 69 |
| **Total** | **32 files** | **326** |

Counts for the original 21 files were re-extracted directly from the test
files with a script and cross-checked against the last full `vitest run`
(164 passed). The 11 newly added files (pagination, AppError, the 5 schema
files, and 4 new controller files: adminScope, application, invitation,
referee) plus the extensions to `team.controller.test.ts` (+10) and
`user.controller.test.ts` (+3) were counted directly from the test source
as written in this session — run `vitest run` to reconfirm the full 326
once they're in place alongside the rest of the suite.

**Not covered by this suite (by design, different testing approach needed):**
repositories (raw SQL — needs integration tests against a real/test DB) and
route wiring / middleware ordering (needs end-to-end tests, e.g. supertest).
